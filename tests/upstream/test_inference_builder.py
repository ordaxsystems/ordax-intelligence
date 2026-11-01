# Regression adapted from ordaxsystems/ordax-os/tests/test_local_ai_runtime_builder.py @ 0c8b4a55cba2c6ae42fa0425706939568360e04e
import importlib.util
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from unittest import mock

ROOT = Path(__file__).resolve().parents[2]
OS_ROOT = ROOT / "_upstream/ordax-os"
BUILDER_PATH = ROOT / "tools/inference-builder/build.py"
SOURCE_LOCK = OS_ROOT / "system/services/local-ai/source-lock.json"

spec = importlib.util.spec_from_file_location("ordax_local_ai_runtime_builder", BUILDER_PATH)
assert spec and spec.loader
BUILDER = importlib.util.module_from_spec(spec)
spec.loader.exec_module(BUILDER)
BUILDER.configure_os_source(OS_ROOT)


class LocalAiRuntimeBuilderTests(unittest.TestCase):
    def test_source_lock_is_exact_and_runtime_is_loopback_only(self):
        lock = BUILDER.load_source_lock()
        self.assertEqual(lock["engine"]["commit"], "7ab4ee7baad2d920464cbacfad4f4b07cf111fd2")
        self.assertEqual(lock["engine"]["build_targets"], ["llama-server"])
        self.assertEqual(
            lock["engine"]["artifact"],
            {
                "platform": "linux-x86_64",
                "binary_format": "ELF",
                "linkage": "static",
                "sha256": "4a974691b9905b88cb46d97c85c2b035b33592a16cd0239ae4c6687f68799afe",
                "size_bytes": 17039584,
            },
        )
        self.assertEqual(lock["model"]["sha256"], "57d1997790d1744fba5b40a7317df71ea5e2acee28c47e78f0cce39c0703f8cf")
        self.assertEqual(lock["model"]["size_bytes"], 563036064)
        self.assertEqual(lock["model"]["license_text_path"], "third_party/licenses/Apache-2.0.txt")
        self.assertEqual(lock["runtime_defaults"], {"reasoning": "off"})
        self.assertEqual(
            lock["runtime_security"],
            {
                "listen_host": "127.0.0.1",
                "listen_port": 17865,
                "web_ui_enabled": False,
                "built_in_tools_enabled": False,
                "agent_mode_enabled": False,
                "mcp_proxy_enabled": False,
                "runtime_model_download_allowed": False,
            },
        )

    def test_launcher_never_enables_provider_tools_or_network_model_fetch(self):
        lock = BUILDER.load_source_lock()
        launcher = BUILDER.launcher_text(lock)
        self.assertIn("--host 127.0.0.1", launcher)
        self.assertIn("--port 17865", launcher)
        self.assertIn("--reasoning off", launcher)
        self.assertIn("--no-ui", launcher)
        self.assertIn("--no-slots", launcher)
        self.assertIn(lock["model"]["filename"], launcher)
        self.assertIn(lock["model"]["id"], launcher)
        for forbidden in (
            "--tools",
            "--agent",
            "--mcp",
            "--hf-repo",
            "--model-url",
            "0.0.0.0",
        ):
            self.assertNotIn(forbidden, launcher)

    def test_builder_rejects_relaxed_runtime_security(self):
        lock = json.loads(SOURCE_LOCK.read_text(encoding="utf-8"))
        lock["runtime_security"]["listen_host"] = "0.0.0.0"
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "source-lock.json"
            path.write_text(json.dumps(lock), encoding="utf-8")
            with self.assertRaisesRegex(BUILDER.RuntimeBuildError, "runtime security"):
                BUILDER.load_source_lock(path)

    def test_builder_rejects_malformed_engine_artifact_pin(self):
        lock = json.loads(SOURCE_LOCK.read_text(encoding="utf-8"))
        lock["engine"]["artifact"]["sha256"] = "0" * 63
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "source-lock.json"
            path.write_text(json.dumps(lock), encoding="utf-8")
            with self.assertRaisesRegex(BUILDER.RuntimeBuildError, "engine artifact pin"):
                BUILDER.load_source_lock(path)

    def test_builder_rejects_model_license_identity_drift(self):
        lock = json.loads(SOURCE_LOCK.read_text(encoding="utf-8"))
        for value in (None, "MIT", "Proprietary", "apache-2.0"):
            with self.subTest(license=value):
                altered = json.loads(json.dumps(lock))
                altered["model"]["license"] = value
                with tempfile.TemporaryDirectory() as directory:
                    path = Path(directory) / "source-lock.json"
                    path.write_text(json.dumps(altered), encoding="utf-8")
                    with self.assertRaisesRegex(
                        BUILDER.RuntimeBuildError,
                        "model license is not approved",
                    ):
                        BUILDER.load_source_lock(path)

    def test_current_candidate_includes_exact_mit_and_apache_license_sources(self):
        lock = BUILDER.load_source_lock()
        self.assertEqual(lock["engine"]["license"], "MIT")
        self.assertEqual(lock["model"]["license"], "Apache-2.0")
        model_license = OS_ROOT / lock["model"]["license_text_path"]
        contents = model_license.read_text(encoding="utf-8")
        self.assertIn("Apache License", contents[:120])
        self.assertIn("Version 2.0, January 2004", contents[:160])
        builder = BUILDER_PATH.read_text(encoding="utf-8")
        self.assertIn('runtime / "licenses/llama.cpp-MIT.txt"', builder)
        self.assertIn('runtime / "licenses/model-Apache-2.0.txt"', builder)

    def test_model_filename_rejects_shell_metacharacters_and_url_fragments(self):
        original = json.loads(SOURCE_LOCK.read_text(encoding="utf-8"))
        forbidden = (
            "model$(touch injected).gguf",
            "model`echo injected`.gguf",
            'model" --host 0.0.0.0 ".gguf',
            "model\ninjected.gguf",
            "model?download=1.gguf",
            "model#fragment.gguf",
            "model%20space.gguf",
            "../../outside.gguf",
            "model\\outside.gguf",
            "model.gguf;command",
            "..",
            ".",
            "",
        )
        for filename in forbidden:
            with self.subTest(filename=filename):
                lock = json.loads(json.dumps(original))
                lock["model"]["filename"] = filename
                with tempfile.TemporaryDirectory() as directory:
                    path = Path(directory) / "source-lock.json"
                    path.write_text(json.dumps(lock), encoding="utf-8")
                    with self.assertRaisesRegex(
                        BUILDER.RuntimeBuildError, "model filename is unsafe",
                    ):
                        BUILDER.load_source_lock(path)
                # The model URL and launch script share one validator, even
                # when invoked independently of the load_source_lock entry.
                with self.assertRaisesRegex(BUILDER.RuntimeBuildError, "model filename is unsafe"):
                    BUILDER.model_url(lock)
                with self.assertRaisesRegex(BUILDER.RuntimeBuildError, "model filename is unsafe"):
                    BUILDER.launcher_text(lock)

    def test_huggingface_repository_is_a_literal_owner_repo_pair(self):
        original = json.loads(SOURCE_LOCK.read_text(encoding="utf-8"))
        forbidden = (
            "owner",
            "owner/repo/extra",
            "owner/../repo",
            "owner/..",
            "owner/repo?download=true",
            "owner/repo#fragment",
            "owner/repo\nx",
            "owner/repo space",
            "owner\\other/repo",
            "https://other.example/repo",
            "/repo",
            "owner/",
            "owner/repo%2Fother",
        )
        for repository in forbidden:
            with self.subTest(repository=repository):
                lock = json.loads(json.dumps(original))
                lock["model"]["repository"] = repository
                with tempfile.TemporaryDirectory() as directory:
                    path = Path(directory) / "source-lock.json"
                    path.write_text(json.dumps(lock), encoding="utf-8")
                    with self.assertRaisesRegex(
                        BUILDER.RuntimeBuildError, "model repository is invalid",
                    ):
                        BUILDER.load_source_lock(path)
                with self.assertRaisesRegex(BUILDER.RuntimeBuildError, "model repository is invalid"):
                    BUILDER.model_url(lock)
                with self.assertRaisesRegex(BUILDER.RuntimeBuildError, "model repository is invalid"):
                    BUILDER.launcher_text(lock)

    def test_reviewed_model_source_remains_safe_in_url_and_launcher(self):
        lock = BUILDER.load_source_lock()
        self.assertEqual(
            BUILDER.validate_model_source_path(lock["model"]),
            lock["model"]["filename"],
        )
        url = BUILDER.model_url(lock)
        self.assertTrue(url.startswith("https://huggingface.co/"))
        self.assertIn("/resolve/" + lock["model"]["upstream_revision"] + "/", url)
        launcher = BUILDER.launcher_text(lock)
        self.assertIn('--model "$runtime_root/models/' + lock["model"]["filename"] + '"', launcher)
        self.assertNotIn("$(", launcher)
        self.assertNotIn(chr(96), launcher)

    def test_model_url_is_revision_pinned(self):
        lock = BUILDER.load_source_lock()
        url = BUILDER.model_url(lock)
        self.assertIn("/resolve/9447f74/", url)
        self.assertTrue(url.endswith("Qwen3.5-0.8B-Q4_0.gguf?download=true"))


    def test_builder_rejects_symlinked_artifact_roots_before_download(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            outside = root / "outside"
            outside.mkdir()
            out_link = root / "out-link"
            cache_link = root / "cache-link"
            out_link.symlink_to(outside, target_is_directory=True)
            cache_link.symlink_to(outside, target_is_directory=True)
            with (
                mock.patch.object(BUILDER.platform, "system", return_value="Linux"),
                mock.patch.object(BUILDER.platform, "machine", return_value="x86_64"),
                mock.patch.object(BUILDER.shutil, "which", return_value="/usr/bin/true"),
                mock.patch.object(BUILDER, "download_exact", side_effect=AssertionError("unexpected network")),
            ):
                for out_dir, cache_dir in (
                    (out_link, root / "cache"),
                    (root / "out", cache_link),
                ):
                    with self.subTest(out_dir=out_dir, cache_dir=cache_dir):
                        with self.assertRaisesRegex(BUILDER.RuntimeBuildError, "symlink"):
                            BUILDER.build(out_dir, cache_dir)
            self.assertEqual(list(outside.iterdir()), [], "no writes through symlink")

    def test_verifier_rejects_output_root_that_is_a_symlink(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            outside = root / "outside"
            outside.mkdir()
            output = root / "output"
            output.symlink_to(outside, target_is_directory=True)
            with self.assertRaisesRegex(BUILDER.RuntimeBuildError, "symlink"):
                BUILDER.verify(output)

    def test_engine_mirror_refuses_a_link_to_an_outside_git_cache(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            cache = root / "cache"
            cache.mkdir()
            outside = root / "other-git"
            outside.mkdir()
            (outside / "HEAD").write_text("ref: refs/heads/main\n", encoding="utf-8")
            (cache / "llama.cpp.git").symlink_to(outside, target_is_directory=True)
            lock = BUILDER.load_source_lock()
            with mock.patch.object(BUILDER, "run", side_effect=AssertionError("git must not run")):
                with self.assertRaisesRegex(BUILDER.RuntimeBuildError, "mirror cache is unsafe"):
                    BUILDER.prepare_engine_mirror(lock, cache)

    def test_cached_model_and_partial_download_refuse_symlinks_without_clobbering_target(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            outside = root / "outside"
            data = b"verified model content"
            outside.write_bytes(data)
            model = root / "model.gguf"
            model.symlink_to(outside)
            digest = hashlib.sha256(data).hexdigest()
            with self.assertRaisesRegex(BUILDER.RuntimeBuildError, "cached model.*symlink"):
                BUILDER.download_exact("https://invalid.example/model", model, digest, len(data))
            self.assertEqual(outside.read_bytes(), data)

            model.unlink()
            partial = root / "model.gguf.part"
            partial.symlink_to(outside)
            with self.assertRaisesRegex(BUILDER.RuntimeBuildError, "partial model cache.*symlink"):
                BUILDER.download_exact("https://invalid.example/model", model, digest, len(data))
            self.assertEqual(outside.read_bytes(), data)
            self.assertTrue(partial.is_symlink())

    def test_output_cache_overlaps_are_rejected_before_any_download(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with (
                mock.patch.object(BUILDER.platform, "system", return_value="Linux"),
                mock.patch.object(BUILDER.platform, "machine", return_value="x86_64"),
                mock.patch.object(BUILDER.shutil, "which", return_value="/usr/bin/true"),
                mock.patch.object(BUILDER, "download_exact", side_effect=AssertionError("unexpected download")),
            ):
                for out_dir, cache_dir in (
                    (root / "same", root / "same"),
                    (root / "out", root / "out" / "cache"),
                    (root / "cache" / "out", root / "cache"),
                ):
                    with self.subTest(out_dir=out_dir, cache_dir=cache_dir):
                        with self.assertRaisesRegex(BUILDER.RuntimeBuildError, "must not overlap"):
                            BUILDER.build(out_dir, cache_dir)

    def test_directory_helper_rejects_symlinked_parent_components(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            outside = root / "outside"
            outside.mkdir()
            linked_parent = root / "linked-parent"
            linked_parent.symlink_to(outside, target_is_directory=True)
            with self.assertRaisesRegex(BUILDER.RuntimeBuildError, "symlink"):
                BUILDER.require_real_directory(linked_parent / "new-cache", "cache", create=True)
            self.assertFalse((outside / "new-cache").exists())


if __name__ == "__main__":
    unittest.main()

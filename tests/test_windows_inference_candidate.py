"""Windows inference builder regression: no local toolchain or GGUF download required."""
import importlib.util
import pathlib
import sys
import tempfile
import unittest

BUILDER_DIR = pathlib.Path(__file__).resolve().parents[1] / "tools" / "inference-builder"
sys.path.insert(0, str(BUILDER_DIR))
spec = importlib.util.spec_from_file_location("windows_candidate", BUILDER_DIR / "windows-candidate.py")
candidate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(candidate)


class WindowsInferenceCandidateTest(unittest.TestCase):
    def test_windows_x64_only_and_no_linux_cross_build(self):
        candidate.assert_windows_x64("Windows", "AMD64")
        candidate.assert_windows_x64("Windows", "x86_64")
        for system, machine in [("Linux", "x86_64"), ("Windows", "ARM64"), ("Darwin", "arm64")]:
            with self.subTest(system=system, machine=machine):
                with self.assertRaisesRegex(candidate.canonical.RuntimeBuildError, "native Windows x64"):
                    candidate.assert_windows_x64(system, machine)

    def test_independent_builds_use_exact_clean_source_workspace(self):
        # Same absolute build path in each independent proof, no reused
        # objects, no stale sources, and failure rather than sharing a live dir.
        with tempfile.TemporaryDirectory() as root:
            cache = pathlib.Path(root) / "model-cache"
            cache.mkdir()
            expected = pathlib.Path(root).resolve() / "ordax-windows-inference-native-build"
            with candidate.fixed_windows_workspace(cache) as first:
                self.assertEqual(first, expected)
                self.assertTrue(first.is_dir())
                (first / "old.obj").write_bytes(b"stale")
                with self.assertRaisesRegex(candidate.canonical.RuntimeBuildError, "absent and clean"):
                    with candidate.fixed_windows_workspace(cache):
                        pass
            self.assertFalse(expected.exists(), "every independent build must clean all objects")
            with candidate.fixed_windows_workspace(cache) as second:
                self.assertEqual(second, expected)
                self.assertFalse((second / "old.obj").exists())

    def test_windows_proof_paths_are_isolated_without_creating_output_early(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = pathlib.Path(temporary)
            requested_output = root / "signed-evidence"
            requested_cache = root / "acquisition-cache"
            output, cache = candidate.validate_proof_paths(
                requested_output, requested_cache
            )
            # Windows CI may supply a DOS 8.3 alias for the tempfile
            # parent (RUNNER~1), while the canonical validator expands it.
            self.assertEqual(output, requested_output.parent.resolve() / requested_output.name)
            self.assertEqual(cache, requested_cache.resolve())
            self.assertTrue(cache.is_dir())
            self.assertFalse(output.exists(), "candidate output is created after proof only")
            with candidate.fixed_windows_workspace(cache) as workspace:
                self.assertEqual(workspace, root.resolve() / "ordax-windows-inference-native-build")
                self.assertTrue(workspace.is_dir())
            self.assertFalse(workspace.exists(), "workspace is always removed")

    def test_windows_proof_rejects_path_overlap_without_writing_anything(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = pathlib.Path(temporary)
            cache = root / "cache"
            workspace = root / "ordax-windows-inference-native-build"
            cases = (
                (cache, cache),
                (root, cache),
                (cache / "proof", cache),
                (root / "proof", root),
                (workspace, cache),
                (workspace / "proof", cache),
                (root / "proof", workspace),
            )
            for output_path, cache_path in cases:
                with self.subTest(output=output_path, cache=cache_path):
                    with self.assertRaisesRegex(
                        candidate.canonical.RuntimeBuildError, "must not overlap"
                    ):
                        candidate.validate_proof_paths(output_path, cache_path)
            self.assertFalse(cache.exists())
            self.assertFalse(workspace.exists())

    def test_windows_proof_refuses_output_and_cache_symlinks(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = pathlib.Path(temporary)
            outside = root / "outside"
            outside.mkdir()
            output_alias = root / "output-alias"
            cache_alias = root / "cache-alias"
            try:
                output_alias.symlink_to(outside, target_is_directory=True)
                cache_alias.symlink_to(outside, target_is_directory=True)
            except (OSError, NotImplementedError):
                self.skipTest("host does not permit creating directory symlinks")
            with self.assertRaisesRegex(
                candidate.canonical.RuntimeBuildError, "new real directory"
            ):
                candidate.validate_proof_paths(output_alias, root / "cache")
            with self.assertRaisesRegex(
                candidate.canonical.RuntimeBuildError, "cache.*symlink"
            ):
                candidate.validate_proof_paths(root / "proof", cache_alias)
            with self.assertRaisesRegex(
                candidate.canonical.RuntimeBuildError, "cache.*symlink"
            ):
                with candidate.fixed_windows_workspace(cache_alias):
                    pass
            self.assertEqual(list(outside.iterdir()), [], "never write through symlinks")

    def test_windows_proof_rejects_symlinked_output_parent_and_existing_workspace(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = pathlib.Path(temporary)
            outside = root / "outside"
            outside.mkdir()
            alias = root / "alias"
            try:
                alias.symlink_to(outside, target_is_directory=True)
            except (OSError, NotImplementedError):
                self.skipTest("host does not permit creating directory symlinks")
            with self.assertRaisesRegex(
                candidate.canonical.RuntimeBuildError, "output parent.*symlink"
            ):
                candidate.validate_proof_paths(alias / "candidate", root / "cache")
            self.assertEqual(list(outside.iterdir()), [])

            workspace = root / "ordax-windows-inference-native-build"
            workspace.mkdir()
            sentinel = workspace / "existing.obj"
            sentinel.write_bytes(b"do not remove")
            with self.assertRaisesRegex(
                candidate.canonical.RuntimeBuildError, "absent and clean"
            ):
                candidate.validate_proof_paths(root / "proof", root / "cache")
            self.assertEqual(sentinel.read_bytes(), b"do not remove")

    def test_binary_inventory_rejects_missing_executable_or_dll(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = pathlib.Path(temporary)
            with self.assertRaisesRegex(candidate.canonical.RuntimeBuildError, "llama-server.exe"):
                candidate.verify_built_files(root)
            (root / "llama-server.exe").write_bytes(b"MZcandidate")
            with self.assertRaisesRegex(candidate.canonical.RuntimeBuildError, "runtime libraries"):
                candidate.verify_built_files(root)
            for name in (
                "llama.dll", "llama-common.dll", "llama-server-impl.dll",
                "ggml.dll", "ggml-base.dll", "ggml-cpu-x64.dll",
                "ggml-cpu-sandybridge.dll",
            ):
                (root / name).write_bytes(b"MZcandidate")
            with self.assertRaisesRegex(candidate.canonical.RuntimeBuildError, "multi-ISA"):
                candidate.verify_built_files(root)
            (root / "ggml-cpu-haswell.dll").write_bytes(b"MZcandidate")
            files = candidate.verify_built_files(root)
            self.assertEqual(len(files), 9)
            self.assertIn(root / "ggml-cpu-sandybridge.dll", files)
            self.assertIn(root / "ggml-cpu-haswell.dll", files)

    def test_independent_windows_ci_requires_complete_multivariant_hash_equivalence(self):
        workflow = (BUILDER_DIR.parents[1] / ".github" / "workflows"
                    / "windows-inference-candidate.yml").read_text(encoding="utf-8")
        self.assertIn("$firstHashes.Count -lt 9", workflow)
        self.assertIn("$firstHashes.Count -ne $secondHashes.Count", workflow)
        self.assertIn("($firstHashes -join ';') -cne ($secondHashes -join ';')", workflow)
        self.assertIn("throw 'Pinned Windows EXE/DLL outputs are not byte-reproducible'", workflow)
        self.assertNotIn("$firstHashes.Count -ne 8", workflow)
        # PRs enforce the source/path contract without consuming two Windows
        # compile slots. Actual GGUF and EXE/DLL proofs remain manual-only.
        for step in (
            "Compile exact llama.cpp and prove real offline GGUF inference",
            "Rebuild independent Windows PE files and reject nonreproducible digests",
        ):
            with self.subTest(step=step):
                header = workflow.split("- name: " + step, 1)[1].split("shell: pwsh", 1)[0]
                self.assertIn("if: github.event_name == 'workflow_dispatch'", header)
        upload = workflow.split(
            "- uses: actions/upload-artifact@b7c566a772e6b6bfb58ed0dc250532a479d7789f", 1
        )[1].split("with:", 1)[0]
        self.assertIn("if: github.event_name == 'workflow_dispatch'", upload)

    def test_real_proof_must_use_same_os_owned_model_lock_and_no_authority(self):
        source = (BUILDER_DIR / "windows-candidate.py").read_text(encoding="utf-8")
        self.assertIn("canonical.load_source_lock()", source)
        self.assertIn("canonical.download_exact(", source)
        self.assertIn('canonical.prepare_engine_mirror(lock, Path(cache_dir) / "source-cache")', source)
        self.assertIn("canonical.prepare_engine_mirror(", source)
        self.assertIn("canonical.checkout_engine(", source)
        self.assertIn("canonical.attest_os_committed_inputs(lock)", source)
        self.assertIn("out_dir, cache_dir = validate_proof_paths(out_dir, cache_dir)", source)
        self.assertNotIn('"os_source_commit": canonical.source_commit()', source)
        self.assertIn('"activation_authorized": False', source)
        self.assertIn('"signed_release": False', source)
        self.assertIn('"-DCMAKE_EXE_LINKER_FLAGS=/Brepro"', source)
        self.assertIn('"-DCMAKE_SHARED_LINKER_FLAGS=/Brepro"', source)
        self.assertIn('"-DBUILD_SHARED_LIBS=ON"', source)
        self.assertIn('"-DGGML_BACKEND_DL=ON"', source)
        self.assertIn('"-DGGML_CPU_ALL_VARIANTS=ON"', source)
        self.assertIn('"-DGGML_NATIVE=OFF"', source)
        self.assertNotIn('"-DGGML_BACKEND_DL=OFF"', source)
        self.assertIn('"--ctx-size", "2048", "--parallel", "1"', source)
        self.assertIn('"ggml-cpu-x64.dll"', source)
        self.assertIn('"ggml-cpu-sandybridge.dll"', source)
        self.assertIn('"ggml-cpu-haswell.dll"', source)
        self.assertIn('f"-DCMAKE_C_FLAGS=/experimental:deterministic /pathmap:{work}=C:/ordax-inference"', source)
        self.assertIn('f"-DCMAKE_CXX_FLAGS=/experimental:deterministic /pathmap:{work}=C:/ordax-inference"', source)
        self.assertIn('"model_bytes_included": False', source)
        self.assertNotIn("subprocess.run('powershell", source)
        self.assertNotIn("github.com/ggml-org/llama.cpp", source)


if __name__ == "__main__":
    unittest.main()

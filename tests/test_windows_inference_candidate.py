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

    def test_binary_inventory_rejects_missing_executable_or_dll(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = pathlib.Path(temporary)
            with self.assertRaisesRegex(candidate.canonical.RuntimeBuildError, "llama-server.exe"):
                candidate.verify_built_files(root)
            (root / "llama-server.exe").write_bytes(b"MZcandidate")
            with self.assertRaisesRegex(candidate.canonical.RuntimeBuildError, "runtime libraries"):
                candidate.verify_built_files(root)
            (root / "ggml.dll").write_bytes(b"MZcandidate")
            files = candidate.verify_built_files(root)
            self.assertEqual([p.name for p in files], ["ggml.dll", "llama-server.exe"])

    def test_real_proof_must_use_same_os_owned_model_lock_and_no_authority(self):
        source = (BUILDER_DIR / "windows-candidate.py").read_text(encoding="utf-8")
        self.assertIn("canonical.load_source_lock()", source)
        self.assertIn("canonical.download_exact(", source)
        self.assertIn("canonical.prepare_engine_mirror(", source)
        self.assertIn("canonical.checkout_engine(", source)
        self.assertIn("canonical.source_commit()", source)
        self.assertIn('"activation_authorized": False', source)
        self.assertIn('"signed_release": False', source)
        self.assertIn('"-DCMAKE_EXE_LINKER_FLAGS=/Brepro"', source)
        self.assertIn('"-DCMAKE_SHARED_LINKER_FLAGS=/Brepro"', source)
        self.assertIn('f"-DCMAKE_C_FLAGS=/pathmap:{work}=C:/ordax-inference"', source)
        self.assertIn('f"-DCMAKE_CXX_FLAGS=/pathmap:{work}=C:/ordax-inference"', source)
        self.assertIn('"model_bytes_included": False', source)
        self.assertNotIn("subprocess.run('powershell", source)
        self.assertNotIn("github.com/ggml-org/llama.cpp", source)


if __name__ == "__main__":
    unittest.main()

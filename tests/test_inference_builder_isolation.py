import importlib.util
from pathlib import Path
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
FILE=ROOT/"tools/inference-builder/build.py"
SPEC=importlib.util.spec_from_file_location("portable_ordax_builder_boundary",FILE)
module=importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(module)

class BuilderBoundaryTests(unittest.TestCase):
    def test_requires_explicit_os_source_without_fallback(self):
        with self.assertRaisesRegex(module.RuntimeBuildError,"canonical OS source"):
            module.load_source_lock()
    def test_rejects_missing_canonical_manifest_paths(self):
        with tempfile.TemporaryDirectory() as temporary:
            with self.assertRaisesRegex(module.RuntimeBuildError,"manifests"):
                module.configure_os_source(temporary)
    def test_does_not_ship_duplicated_model_or_contract(self):
        self.assertFalse((ROOT/"system/services/local-ai/source-lock.json").exists())
        self.assertFalse((ROOT/"docs/contracts/local-ai.json").exists())
        self.assertFalse((ROOT/"models").exists())

if __name__=="__main__":
    unittest.main()

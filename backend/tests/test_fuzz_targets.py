"""Regression test verifying that ClusterFuzzLite fuzz targets compile and execute cleanly.

Exercises both fuzz_ai_scoring and fuzz_payload_validation with deterministic
pseudo-random byte sequences to ensure the targets remain operational and free of
uncaught exceptions.
"""
import importlib.util
import os
import random
import unittest

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


def _load_fuzz_module(filename: str):
    path = os.path.join(ROOT_DIR, ".clusterfuzzlite", "fuzz_targets", filename)
    spec = importlib.util.spec_from_file_location(filename[:-3], path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class FuzzTargetsExecutionTests(unittest.TestCase):

    def test_fuzz_ai_scoring_execution(self):
        """Verify that fuzz_ai_scoring processes arbitrary byte streams without crashing."""
        mod = _load_fuzz_module("fuzz_ai_scoring.py")
        rng = random.Random(20260920)
        for i in range(150):
            sample_len = rng.randint(8, 512)
            sample_bytes = bytes([rng.randint(0, 255) for _ in range(sample_len)])
            mod.TestOneInput(sample_bytes)

    def test_fuzz_payload_validation_execution(self):
        """Verify that fuzz_payload_validation handles malformed inputs safely."""
        mod = _load_fuzz_module("fuzz_payload_validation.py")
        rng = random.Random(20260920)
        for i in range(150):
            sample_len = rng.randint(4, 512)
            sample_bytes = bytes([rng.randint(0, 255) for _ in range(sample_len)])
            mod.TestOneInput(sample_bytes)


if __name__ == "__main__":
    unittest.main()

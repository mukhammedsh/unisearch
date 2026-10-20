import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend" / "scripts"))

from atomic_json import write_json_atomic  # noqa: E402


class AtomicJsonWriteTests(unittest.TestCase):
    def test_write_uses_utf8_json_and_replaces_the_existing_file(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "universities.json"
            target.write_text("old", encoding="utf-8")

            write_json_atomic(target, [{"name": "Университет"}])

            self.assertEqual('[\n  {\n    "name": "Университет"\n  }\n]\n', target.read_text(encoding="utf-8"))
            self.assertEqual([], list(Path(directory).glob(".universities.json.*.tmp")))

    def test_replace_failure_preserves_original_and_removes_temporary_file(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "universities.json"
            target.write_text("original", encoding="utf-8")

            with patch("atomic_json.os.replace", side_effect=OSError("replace failed")):
                with self.assertRaisesRegex(OSError, "replace failed"):
                    write_json_atomic(target, [{"id": "new"}])

            self.assertEqual("original", target.read_text(encoding="utf-8"))
            self.assertEqual([], list(Path(directory).glob(".universities.json.*.tmp")))


if __name__ == "__main__":
    unittest.main()

import importlib.util
from pathlib import Path
import unittest

ROOT_DIR = Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT_DIR / "data" / "drafts" / "stanford-university-usa-ca" / "capture_directories.py"
MODULE_SPEC = importlib.util.spec_from_file_location("stanford_capture_directories", MODULE_PATH)
if MODULE_SPEC is None or MODULE_SPEC.loader is None:
    raise ImportError(f"Unable to load {MODULE_PATH}")
MODULE = importlib.util.module_from_spec(MODULE_SPEC)
MODULE_SPEC.loader.exec_module(MODULE)


class StanfordCaptureDirectoriesTests(unittest.TestCase):
    def test_rows_removes_script_blocks_case_insensitively(self):
        raw = (
            '<div class="su-card program" data-name="Computer Science" data-school="Engineering">'
            '<SCRIPT>alert("upper")</SCRIPT>'
            '<script>alert("lower")</script>'
            '<p>Program details</p><a href="/program">Program page</a></div>'
        )

        row = MODULE.rows(raw)[0]

        self.assertEqual(row["published_directory_text"], "Program details Program page")
        self.assertEqual(row["links"], [{"label": "Program page", "url": "/program"}])


if __name__ == "__main__":
    unittest.main()

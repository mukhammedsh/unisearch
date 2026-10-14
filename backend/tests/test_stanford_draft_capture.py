import importlib.util
from pathlib import Path
import unittest


SCRIPT_PATH = Path(__file__).parents[1] / "data" / "drafts" / "stanford-university-usa-ca" / "capture_directories.py"
SPEC = importlib.util.spec_from_file_location("stanford_capture_directories", SCRIPT_PATH)
assert SPEC and SPEC.loader
CAPTURE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CAPTURE)


class StanfordDraftCaptureTests(unittest.TestCase):
    def test_program_rows_exclude_script_markup_and_text(self):
        raw = (
            '<div class="su-card program" data-name="Computer Science" data-school="Engineering">'
            'Public text<script>secret <a href="/not-a-program">hidden</a></script>'
            '<a href="/programs/cs">Program details</a></div>'
        )

        row = CAPTURE.rows(raw)[0]

        self.assertEqual(row["published_directory_text"], "Public text Program details")
        self.assertEqual(row["links"], [{"label": "Program details", "url": "/programs/cs"}])


if __name__ == "__main__":
    unittest.main()

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.core.files import RequiredDataUnavailable
from app.main import app
from app.services import exam_support, universities


class RequiredDataFailureTests(unittest.TestCase):
    def test_university_loader_does_not_cache_malformed_data_as_empty(self):
        with tempfile.TemporaryDirectory() as directory:
            data_path = Path(directory) / "universities.json"
            with patch.object(universities, "DATA_PATH", data_path), patch.object(
                universities, "file_mtime", return_value=1
            ), patch.dict(universities._UNI_CACHE, {"mtime": None, "data": [], "by_id": {}, "meta": []}):
                for invalid in ("{", "[]", "[null]"):
                    data_path.write_text(invalid, encoding="utf-8")
                    with self.subTest(data=invalid), self.assertRaises(RequiredDataUnavailable):
                        universities.load_universities()
                self.assertIsNone(universities._UNI_CACHE["mtime"])

    def test_exam_loader_keeps_last_good_cache_and_retries_invalid_file(self):
        with tempfile.TemporaryDirectory() as directory:
            data_path = Path(directory) / "exams.json"
            data_path.write_text("{", encoding="utf-8")
            modified = [1]
            with patch.object(exam_support, "EXAMS_PATH", data_path), patch.object(
                exam_support, "file_mtime", side_effect=lambda _: modified[0]
            ), patch.dict(exam_support._EXAMS_CACHE, {"mtime": None}), patch.dict(
                exam_support.EXAMS_CONFIG, {}, clear=True
            ), patch.dict(exam_support.EXAM_WHITELIST, {}, clear=True):
                with self.assertRaises(RequiredDataUnavailable):
                    exam_support.ensure_exams_cache()
                self.assertIsNone(exam_support._EXAMS_CACHE["mtime"])
                self.assertEqual({}, exam_support.EXAMS_CONFIG)

                data_path.write_text(json.dumps({"SAMPLE": {"min": 0, "max": 10}}), encoding="utf-8")
                modified[0] = 2
                exam_support.ensure_exams_cache()
                self.assertIn("SAMPLE", exam_support.EXAMS_CONFIG)
                self.assertEqual(2, exam_support._EXAMS_CACHE["mtime"])

    def test_ready_returns_503_when_required_dataset_is_unavailable(self):
        with patch("app.services.universities.file_mtime", return_value=None):
            response = TestClient(app).get("/ready")

        self.assertEqual(503, response.status_code)
        self.assertEqual({"detail": "Required application data is unavailable"}, response.json())


if __name__ == "__main__":
    unittest.main()

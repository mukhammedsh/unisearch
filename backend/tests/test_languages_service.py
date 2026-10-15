import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from app.services import languages


class LanguageConfigCacheTests(unittest.TestCase):
    def test_config_cache_reloads_on_mtime_change_and_falls_back_for_bad_files(self):
        with tempfile.TemporaryDirectory() as directory:
            config_path = Path(directory) / "languages.json"
            modified = [None]

            with patch.object(languages, "LANGUAGES_PATH", config_path), patch.object(
                languages, "file_mtime", side_effect=lambda _: modified[0]
            ), patch.dict(languages._LANG_CACHE, {"mtime": None, "data": {}, "index": None}):
                self.assertEqual({}, languages.load_languages())
                self.assertEqual(
                    {"version": 0, "cefr": [], "languages": [], "language_exams": {}, "waiver_rules": []},
                    languages.get_languages_config(),
                )

                def write_config(version):
                    config_path.write_text(json.dumps({
                        "version": version,
                        "languages": [{"code": "en"}],
                        "cefr": [{"code": "B2", "id": 4}],
                        "language_exams": {"en": []},
                    }), encoding="utf-8")

                modified[0] = 1
                write_config(1)
                self.assertEqual(1, languages.get_languages_config()["version"])
                self.assertEqual({"en"}, languages.get_languages_index()["codes"])
                self.assertEqual({"B2": 4}, languages.get_languages_index()["cefr_map"])

                write_config(2)
                self.assertEqual(1, languages.get_languages_config()["version"])
                modified[0] = 2
                self.assertEqual(2, languages.get_languages_config()["version"])

                config_path.write_text("{", encoding="utf-8")
                modified[0] = 3
                self.assertEqual({}, languages.load_languages())
                self.assertEqual(
                    {"version": 0, "cefr": [], "languages": [], "language_exams": {}, "waiver_rules": []},
                    languages.get_languages_config(),
                )


class ValidateLanguageExamFromCfgTests(unittest.TestCase):
    def test_valid_score_type_float_and_int(self):
        cfg_float = {"type": "float", "min": 0, "max": 100}
        score_float = languages.validate_language_exam_from_cfg(cfg_float, "85.5")
        self.assertIsInstance(score_float, float)
        self.assertEqual(score_float, 85.5)

        cfg_int = {"type": "int", "min": 0, "max": 100}
        score_int = languages.validate_language_exam_from_cfg(cfg_int, 85)
        self.assertIsInstance(score_int, int)
        self.assertEqual(score_int, 85)

    def test_min_and_max_bounds(self):
        cfg = {"min": 10, "max": 90}

        # Exact min and max bounds
        self.assertEqual(languages.validate_language_exam_from_cfg(cfg, 10), 10.0)
        self.assertEqual(languages.validate_language_exam_from_cfg(cfg, 90), 90.0)

        # Out of bounds below min
        with self.assertRaises(ValueError) as cm_below:
            languages.validate_language_exam_from_cfg(cfg, 9.9)
        self.assertIn("Score must be between 10 and 90", str(cm_below.exception))

        # Out of bounds above max
        with self.assertRaises(ValueError) as cm_above:
            languages.validate_language_exam_from_cfg(cfg, 90.1)
        self.assertIn("Score must be between 10 and 90", str(cm_above.exception))

    def test_step_increment_validation(self):
        cfg = {"min": 0, "max": 9, "step": 0.5}

        # Valid step increments
        self.assertEqual(languages.validate_language_exam_from_cfg(cfg, 6.5), 6.5)
        self.assertEqual(languages.validate_language_exam_from_cfg(cfg, 7.0), 7.0)

        # Invalid step increment
        with self.assertRaises(ValueError) as cm:
            languages.validate_language_exam_from_cfg(cfg, 6.3)
        self.assertIn("Score must follow step=0.5", str(cm.exception))

    def test_decimals_allowed_validation(self):
        cfg = {"min": 0, "max": 120, "decimals_allowed": [0, 5]}

        # Allowed decimals (.0 and .5)
        self.assertEqual(languages.validate_language_exam_from_cfg(cfg, 100.0), 100.0)
        self.assertEqual(languages.validate_language_exam_from_cfg(cfg, 100.5), 100.5)

        # Disallowed decimal (.2)
        with self.assertRaises(ValueError) as cm:
            languages.validate_language_exam_from_cfg(cfg, 100.2)
        self.assertIn("Decimals not allowed for this exam", str(cm.exception))

    def test_invalid_non_numeric_input(self):
        cfg = {"min": 0, "max": 100}
        with self.assertRaises(Exception):
            languages.validate_language_exam_from_cfg(cfg, "invalid_score")


if __name__ == "__main__":
    unittest.main()

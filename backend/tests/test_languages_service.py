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

    def test_get_languages_index_returns_default_index(self):
        with patch.dict(languages._LANG_CACHE, {"mtime": None, "data": {}, "index": None}):
            idx = languages.get_languages_index()
            self.assertIn("codes", idx)
            self.assertIn("cefr_map", idx)
            self.assertIn("exams_by_lang", idx)
            self.assertIn("en", idx["codes"])

    def test_get_languages_index_rebuilds_index_if_cached_index_is_none(self):
        test_data = {
            "languages": [{"code": "fr"}],
            "cefr": [{"code": "C1", "id": 5}],
            "language_exams": {"fr": [{"id": "DELF"}]},
        }
        with patch.dict(languages._LANG_CACHE, {"mtime": 100, "data": test_data, "index": None}), patch.object(
            languages, "file_mtime", return_value=100
        ):
            idx = languages.get_languages_index()
            self.assertEqual(idx["codes"], {"fr"})
            self.assertEqual(idx["cefr_map"], {"C1": 5})
            self.assertEqual(idx["exams_by_lang"], {"fr": [{"id": "DELF"}]})

    def test_get_languages_index_handles_empty_data(self):
        with patch.dict(languages._LANG_CACHE, {"mtime": 100, "data": {}, "index": None}), patch.object(
            languages, "file_mtime", return_value=100
        ):
            idx = languages.get_languages_index()
            self.assertEqual(idx, {"codes": set(), "cefr_map": {}, "exams_by_lang": {}})


if __name__ == "__main__":
    unittest.main()

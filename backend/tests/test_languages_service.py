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


if __name__ == "__main__":
    unittest.main()

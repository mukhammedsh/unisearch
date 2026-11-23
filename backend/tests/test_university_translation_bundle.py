import unittest
from unittest.mock import patch

from app.services import universities as uni_service


class UniversityTranslationBundleTests(unittest.TestCase):
    def test_get_university_translation_bundle_default_lang(self):
        bundle = uni_service.get_university_translation_bundle()
        self.assertEqual("eng", bundle.get("lang"))
        self.assertIsInstance(bundle.get("schema_version"), int)
        self.assertIsInstance(bundle.get("data"), dict)

    def test_get_university_translation_bundle_russian_lang(self):
        bundle = uni_service.get_university_translation_bundle("rus")
        self.assertEqual("rus", bundle.get("lang"))
        self.assertIsInstance(bundle.get("schema_version"), int)
        self.assertIsInstance(bundle.get("data"), dict)

    def test_get_university_translation_bundle_kazakh_lang(self):
        bundle = uni_service.get_university_translation_bundle("kaz")
        self.assertEqual("kaz", bundle.get("lang"))
        self.assertIsInstance(bundle.get("schema_version"), int)
        self.assertIsInstance(bundle.get("data"), dict)

    def test_get_university_translation_bundle_language_normalization(self):
        russian_cases = ["rus", "RU", "ru-RU", "  rus  "]
        for case in russian_cases:
            with self.subTest(case=case):
                bundle = uni_service.get_university_translation_bundle(case)
                self.assertEqual("rus", bundle.get("lang"))

        kazakh_cases = ["kaz", "KK", "kk-KZ", "  kaz  "]
        for case in kazakh_cases:
            with self.subTest(case=case):
                bundle = uni_service.get_university_translation_bundle(case)
                self.assertEqual("kaz", bundle.get("lang"))

        english_cases = ["eng", "EN", "en-US", "fr", "xyz", "", None]
        for case in english_cases:
            with self.subTest(case=case):
                bundle = uni_service.get_university_translation_bundle(case)
                self.assertEqual("eng", bundle.get("lang"))

    def test_get_university_translation_bundle_mocked_custom_schema_version(self):
        mock_raw = {
            "schema_version": 42,
            "languages": {
                "rus": {
                    "groups": {"universities": {"mit": "Массачусетский технологический институт"}},
                }
            },
        }
        with patch.object(uni_service, "_load_university_translations_raw", return_value=mock_raw):
            bundle = uni_service.get_university_translation_bundle("rus")
            self.assertEqual("rus", bundle.get("lang"))
            self.assertEqual(42, bundle.get("schema_version"))
            self.assertEqual(
                {"groups": {"universities": {"mit": "Массачусетский технологический институт"}}},
                bundle.get("data"),
            )

    def test_get_university_translation_bundle_mocked_missing_schema_version_defaults_to_1(self):
        mock_raw = {
            "languages": {
                "eng": {"groups": {}},
            }
        }
        with patch.object(uni_service, "_load_university_translations_raw", return_value=mock_raw):
            bundle = uni_service.get_university_translation_bundle("eng")
            self.assertEqual("eng", bundle.get("lang"))
            self.assertEqual(1, bundle.get("schema_version"))
            self.assertEqual({"groups": {}}, bundle.get("data"))

    def test_get_university_translation_bundle_mocked_missing_language_pack(self):
        mock_raw = {
            "schema_version": 2,
            "languages": {
                "eng": {"groups": {}},
            },
        }
        with patch.object(uni_service, "_load_university_translations_raw", return_value=mock_raw):
            bundle = uni_service.get_university_translation_bundle("kaz")
            self.assertEqual("kaz", bundle.get("lang"))
            self.assertEqual(2, bundle.get("schema_version"))
            self.assertEqual({}, bundle.get("data"))

    def test_get_university_translation_bundle_mocked_non_dict_languages_field(self):
        non_dict_values = ["invalid_str", [1, 2, 3], 123, None, True]
        for bad_languages in non_dict_values:
            with self.subTest(bad_languages=bad_languages):
                mock_raw = {"schema_version": 1, "languages": bad_languages}
                with patch.object(uni_service, "_load_university_translations_raw", return_value=mock_raw):
                    bundle = uni_service.get_university_translation_bundle("eng")
                    self.assertEqual("eng", bundle.get("lang"))
                    self.assertEqual(1, bundle.get("schema_version"))
                    self.assertEqual({}, bundle.get("data"))

    def test_get_university_translation_bundle_mocked_non_dict_language_pack(self):
        non_dict_packs = ["invalid_pack", [1, 2], 100, None, True]
        for bad_pack in non_dict_packs:
            with self.subTest(bad_pack=bad_pack):
                mock_raw = {"schema_version": 1, "languages": {"eng": bad_pack}}
                with patch.object(uni_service, "_load_university_translations_raw", return_value=mock_raw):
                    bundle = uni_service.get_university_translation_bundle("eng")
                    self.assertEqual("eng", bundle.get("lang"))
                    self.assertEqual(1, bundle.get("schema_version"))
                    self.assertEqual({}, bundle.get("data"))

    def test_get_university_translation_bundle_mocked_empty_raw_data(self):
        with patch.object(uni_service, "_load_university_translations_raw", return_value={}):
            bundle = uni_service.get_university_translation_bundle("rus")
            self.assertEqual({
                "lang": "rus",
                "schema_version": 1,
                "data": {},
            }, bundle)


class UniversityTranslationNumberFormatTests(unittest.TestCase):
    def test_money_in_translations_keeps_the_source_decimal_point(self):
        import json
        import re
        from app.core.paths import UNIVERSITIES_TRANSLATIONS_PATH

        with open(UNIVERSITIES_TRANSLATIONS_PATH, encoding="utf-8") as handle:
            languages = json.load(handle)["languages"]
        # "£34,50" beside "£10,050" reads as a different number; amounts with a currency sign keep the source's "34.50".
        comma_cents = re.compile(r"[£$€]\d{1,3},\d{2}(?![\d]|$)")  # not at the end: some source keys are cut mid-number
        offenders = []

        def walk(node, path):
            if isinstance(node, dict):
                for key, value in node.items():
                    walk(value, path + [key])
            elif isinstance(node, list):
                for index, value in enumerate(node):
                    walk(value, path + [index])
            elif isinstance(node, str) and comma_cents.search(node):
                offenders.append((path[:3], comma_cents.search(node).group()))

        for language in ("rus", "kaz"):
            walk(languages[language], [language])
        self.assertEqual([], offenders)


if __name__ == "__main__":
    unittest.main()

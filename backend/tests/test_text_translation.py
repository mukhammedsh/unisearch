import unittest
from unittest.mock import patch

from app.services import text_translation as text_translation_service


class TextTranslationTests(unittest.TestCase):
    def setUp(self):
        text_translation_service._TRANSLATION_CACHE.clear()
        text_translation_service._PROVIDER_BACKOFF_UNTIL = 0.0

    def test_translates_english_text_when_enabled(self):
        with patch.object(text_translation_service, "ML_INTEREST_TRANSLATION_ENABLED", True), patch.object(
            text_translation_service, "ML_INTEREST_TRANSLATION_PROVIDER", "libretranslate"
        ), patch.object(
            text_translation_service, "ML_INTEREST_TRANSLATION_SOURCE", "auto"
        ), patch.object(
            text_translation_service, "ML_INTEREST_TRANSLATION_TARGET", "en"
        ), patch.object(
            text_translation_service, "_libretranslate_request", return_value="computer science and ai"
        ) as mock_translate:
            out = text_translation_service.translate_interest_text_for_ml(
                "computer science ai", source_hint="eng", client_key="u1"
            )

        self.assertEqual("computer science and ai", out.get("text"))
        self.assertTrue(bool(out.get("translated")))
        self.assertEqual("translated", out.get("reason"))
        self.assertEqual("libretranslate", out.get("provider"))
        mock_translate.assert_called_once_with("computer science ai", "auto", "en")

    def test_uses_cache_for_same_text(self):
        with patch.object(text_translation_service, "ML_INTEREST_TRANSLATION_ENABLED", True), patch.object(
            text_translation_service, "ML_INTEREST_TRANSLATION_PROVIDER", "libretranslate"
        ), patch.object(
            text_translation_service, "_libretranslate_request", return_value="i want data science"
        ) as mock_translate:
            first = text_translation_service.translate_interest_text_for_ml("хочу data science", source_hint="rus", client_key="u1")
            second = text_translation_service.translate_interest_text_for_ml("хочу data science", source_hint="rus", client_key="u1")

        self.assertEqual("i want data science", first.get("text"))
        self.assertEqual("i want data science", second.get("text"))
        self.assertEqual(1, mock_translate.call_count)
        self.assertTrue(bool(second.get("cacheHit")))

    def test_falls_back_to_raw_when_provider_fails(self):
        with patch.object(text_translation_service, "ML_INTEREST_TRANSLATION_ENABLED", True), patch.object(
            text_translation_service, "ML_INTEREST_TRANSLATION_PROVIDER", "libretranslate"
        ), patch.object(
            text_translation_service, "_libretranslate_request", side_effect=RuntimeError("down")
        ):
            out = text_translation_service.translate_interest_text_for_ml("хочу ai", source_hint="rus", client_key="u1")

        self.assertEqual("хочу ai", out.get("text"))
        self.assertFalse(bool(out.get("translated")))
        self.assertEqual("provider_error", out.get("reason"))


if __name__ == "__main__":
    unittest.main()

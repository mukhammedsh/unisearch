import os
import unittest
from unittest.mock import patch

from app.core import settings
from app.core.http_cache import apply_etag_or_not_modified, etag_matches, resolve_search_lang
from app.core.utils import normalize_search_lang
from fastapi import Response


class _DummyRequest:
    def __init__(self, headers: dict[str, str] | None = None):
        self.headers = headers or {}


class CoreUtilitiesTests(unittest.TestCase):
    def test_normalize_search_lang_maps_locales_and_defaults_to_eng(self):
        self.assertEqual(normalize_search_lang("ru"), "rus")
        self.assertEqual(normalize_search_lang("ru-RU"), "rus")
        self.assertEqual(normalize_search_lang("RUS"), "rus")
        self.assertEqual(normalize_search_lang("kk"), "kaz")
        self.assertEqual(normalize_search_lang("kk-KZ"), "kaz")
        self.assertEqual(normalize_search_lang("kaz"), "kaz")
        self.assertEqual(normalize_search_lang("en-US"), "eng")
        self.assertEqual(normalize_search_lang(None), "eng")
        self.assertEqual(normalize_search_lang("   "), "eng")

    def test_resolve_search_lang_prefers_explicit_override_then_accept_language(self):
        req = _DummyRequest({"accept-language": "kk-KZ,ru;q=0.9,en;q=0.8"})
        self.assertEqual(resolve_search_lang("rus", req), "rus")
        self.assertEqual(resolve_search_lang("  ", req), "kaz")
        self.assertEqual(resolve_search_lang(None, None), "eng")

    def test_etag_matches_and_apply_etag_or_not_modified(self):
        self.assertFalse(etag_matches("", '"abc"'))
        self.assertTrue(etag_matches("*", '"abc"'))
        self.assertTrue(etag_matches('"other", "abc"', '"abc"'))
        self.assertTrue(etag_matches('W/"abc"', '"abc"'))
        self.assertFalse(etag_matches('"xyz"', '"abc"'))

        resp = Response()
        not_modified = apply_etag_or_not_modified(
            _DummyRequest({"if-none-match": 'W/"etag-1"'}),
            resp,
            etag='"etag-1"',
            cache_control="public, max-age=300",
        )
        self.assertIsNotNone(not_modified)
        self.assertEqual(not_modified.status_code, 304)
        self.assertEqual(resp.headers["ETag"], '"etag-1"')
        self.assertEqual(resp.headers["Cache-Control"], "public, max-age=300")
        self.assertEqual(resp.headers["Vary"], "Accept-Language")

        miss_resp = Response()
        self.assertIsNone(
            apply_etag_or_not_modified(
                _DummyRequest({"if-none-match": '"etag-other"'}),
                miss_resp,
                etag='"etag-1"',
                cache_control="public, max-age=60",
            )
        )
        self.assertEqual(miss_resp.headers["ETag"], '"etag-1"')

    def test_settings_env_int_and_env_float_parse_and_fallback(self):
        with patch.dict(
            os.environ,
            {
                "TEST_INT": "42",
                "TEST_ZERO": "0",
                "TEST_BLANK": "   ",
                "TEST_BAD": "not-an-int",
                "TEST_FALLBACK": "9001",
                "TEST_FLOAT": "2.5",
                "TEST_FLOAT_BAD": "nan-or-bad",
            },
            clear=False,
        ):
            self.assertEqual(settings._env_int("TEST_INT", 10), 42)
            self.assertEqual(settings._env_int("TEST_ZERO", 10), 0)
            self.assertEqual(settings._env_int("TEST_BLANK", 10), 10)
            self.assertEqual(settings._env_int("TEST_BAD", 10), 10)
            self.assertEqual(settings._env_int("TEST_BLANK", 8000, fallback_env="TEST_FALLBACK"), 9001)
            self.assertEqual(settings._env_float("TEST_FLOAT", 1.0), 2.5)
            self.assertEqual(settings._env_float("TEST_FLOAT_BAD", 1.5), 1.5)
            self.assertEqual(settings._env_float("TEST_BLANK", 1.5), 1.5)


if __name__ == "__main__":
    unittest.main()

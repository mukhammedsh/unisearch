import unittest
from unittest.mock import MagicMock, patch

from app.services import background_tasks


class BackgroundTasksTests(unittest.TestCase):
    def test_warmup_runtime_success(self):
        res = background_tasks.warmup_runtime("manual")
        self.assertTrue(res.get("ok"))
        self.assertEqual(res.get("trigger"), "manual")
        self.assertGreater(res.get("universities_total", 0), 0)
        self.assertGreater(res.get("countries_total", 0), 0)
        self.assertGreater(res.get("languages_total", 0), 0)
        self.assertGreater(res.get("exams_total", 0), 0)
        self.assertIn("duration_ms", res)

    def test_warmup_runtime_startup_sync_skips_ml(self):
        with patch.object(background_tasks, "WARMUP_ML_ON_STARTUP", False):
            res = background_tasks.warmup_runtime("startup_sync")
            self.assertTrue(res.get("ok"))
            self.assertEqual(res.get("trigger"), "startup_sync")
            self.assertFalse(res.get("ml_ready"))
            self.assertTrue(res.get("ml_skipped"))

    def test_warmup_runtime_error_resilience(self):
        with patch("app.services.universities.load_universities", side_effect=RuntimeError("disk read fail")):
            res = background_tasks.warmup_runtime("test_err_unis")
            self.assertFalse(res["ok"])
            self.assertEqual(res["universities_total"], 0)

        with patch("app.services.universities.get_locations", side_effect=ValueError("bad locations")):
            res = background_tasks.warmup_runtime("test_err_locs")
            self.assertFalse(res["ok"])
            self.assertEqual(res["countries_total"], 0)

        with patch("app.services.languages.get_languages_config", side_effect=IOError("no lang cfg")):
            res = background_tasks.warmup_runtime("test_err_lang")
            self.assertFalse(res["ok"])
            self.assertEqual(res["languages_total"], 0)

        with patch("app.services.exams.ensure_exams_cache", side_effect=Exception("exams fail")):
            res = background_tasks.warmup_runtime("test_err_exams")
            self.assertFalse(res["ok"])
            self.assertEqual(res["exams_total"], 0)

        with patch("app.services.currency.get_rates", side_effect=Exception("rates fail")):
            res = background_tasks.warmup_runtime("test_err_currency")
            self.assertFalse(res["ok"])
            self.assertFalse(res["currency_rates_loaded"])

        mock_ml = MagicMock()
        mock_ml.is_ready.side_effect = Exception("ML model crashed")
        with patch("app.services.background_tasks.get_ml_recommender", return_value=mock_ml):
            res = background_tasks.warmup_runtime("test_err_ml")
            self.assertFalse(res["ok"])
            self.assertFalse(res["ml_ready"])


if __name__ == "__main__":
    unittest.main()

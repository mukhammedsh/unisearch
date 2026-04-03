import unittest

from fastapi.testclient import TestClient

from app.main import app


class ExamsApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_get_exams_config_contains_expected_keys(self):
        response = self.client.get("/exams/config")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIsInstance(data, dict)
        for key in (
            "SAT",
            "ACT",
            "GPA",
            "IB_DIPLOMA",
            "AP_TOTAL",
            "A_LEVEL_CERT",
            "EGE",
            "SWISS_MATURITY_CERT",
            "GERMAN_ABITUR_CERT",
            "OSSD_CERT",
            "HKDSE_LEVEL",
            "HKDSE_WEIGHTED_TOTAL",
            "UNT",
            "NUET",
        ):
            self.assertIn(key, data)
        self.assertIn("normalization", data.get("SAT") or {})
        self.assertEqual(1010, int(((data.get("SAT") or {}).get("normalization") or {}).get("p50", 0)))

    def test_validate_exam_accepts_valid_score(self):
        response = self.client.post(
            "/exams/validate",
            json={"exam": "SAT", "score": 1450},
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(bool(data.get("ok")))
        self.assertEqual("SAT", data.get("exam"))
        self.assertEqual(1450, int(data.get("score")))

    def test_validate_exam_rejects_invalid_step(self):
        response = self.client.post(
            "/exams/validate",
            json={"exam": "SAT", "score": 1451},
        )
        self.assertEqual(response.status_code, 400)
        detail = str(response.json().get("detail", ""))
        self.assertIn("step", detail.lower())

    def test_validate_exam_alias_resolves_to_canonical_key(self):
        response = self.client.post(
            "/exams/validate",
            json={"exam": "NUET_TOTAL", "score": 210},
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual("NUET", data.get("exam"))
        self.assertEqual(210, int(data.get("score")))

    def test_validate_a_level_grades_returns_internal_score_and_raw_value(self):
        response = self.client.post(
            "/exams/validate",
            json={"exam": "A_LEVEL_CERT", "raw_value": "A*A*A"},
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual("A_LEVEL_CERT", data.get("exam"))
        self.assertEqual(17, int(data.get("score")))
        self.assertEqual("A*A*A", data.get("raw_value"))
        self.assertEqual("A*A*A", data.get("display_value"))

    def test_validate_bool_exam_accepts_binary_flag(self):
        response = self.client.post(
            "/exams/validate",
            json={"exam": "SWISS_MATURITY_CERT", "score": 1},
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual("SWISS_MATURITY_CERT", data.get("exam"))
        self.assertEqual(1, int(data.get("score")))

    def test_validate_hkdse_weighted_total_accepts_decimal_score(self):
        response = self.client.post(
            "/exams/validate",
            json={"exam": "HKDSE_WEIGHTED_TOTAL", "score": 42.88},
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual("HKDSE_WEIGHTED_TOTAL", data.get("exam"))
        self.assertAlmostEqual(42.88, float(data.get("score") or 0.0), places=2)


if __name__ == "__main__":
    unittest.main()

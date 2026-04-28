import unittest

from app.services.universities import _get_university_acceptance_rate


class UniversityAcceptanceRateTests(unittest.TestCase):
    def test_reads_direct_acceptance_rate(self):
        university = {"academics": {"acceptance_rate_percent": 15.5}}
        self.assertEqual(_get_university_acceptance_rate(university), 15.5)

    def test_reads_direct_acceptance_rate_from_string(self):
        university = {"academics": {"acceptance_rate_percent": "20.0"}}
        self.assertEqual(_get_university_acceptance_rate(university), 20.0)

    def test_averages_program_acceptance_rates(self):
        university = {
            "academics": {
                "programs": [
                    {"acceptance_rate_percent": 10.0},
                    {"acceptance_rate_percent": "30.0"},
                ]
            }
        }
        self.assertEqual(_get_university_acceptance_rate(university), 20.0)

    def test_ignores_programs_without_acceptance_rates(self):
        university = {
            "academics": {
                "programs": [
                    {"acceptance_rate_percent": 15.0},
                    {},
                    {"acceptance_rate_percent": 25.0},
                ]
            }
        }
        self.assertEqual(_get_university_acceptance_rate(university), 20.0)

    def test_returns_none_when_acceptance_rate_is_missing(self):
        cases = [
            {},
            {"academics": {"programs": []}},
            {"academics": {"programs": [{"name": "CS"}, {"name": "Math"}]}},
            {"academics": {"acceptance_rate_percent": None}},
        ]
        for university in cases:
            with self.subTest(university=university):
                self.assertIsNone(_get_university_acceptance_rate(university))


if __name__ == "__main__":
    unittest.main()

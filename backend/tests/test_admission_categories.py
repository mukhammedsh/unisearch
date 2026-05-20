import copy
import unittest

from app.services import universities as uni_service


def _category(category_id, label, profiles, **extra):
    row = {
        "id": category_id,
        "label": label,
        "scope": "general",
        "program_ids": [],
        "program_names": [],
        "requirement_profiles": profiles,
    }
    row.update(extra)
    return row


class AdmissionCategoryTests(unittest.TestCase):
    def test_normalize_schema_hides_foundation_only_category_from_bachelor_scope(self):
        row = {
            "id": "nu-demo",
            "name": "NU Demo",
            "academics": {
                "programs": [
                    {"name": "Computer Science", "study_levels": ["Bachelor"], "study_mode": "On-campus"},
                    {"name": "Mechanical and Aerospace Engineering", "study_levels": ["Bachelor"], "study_mode": "On-campus"},
                    {"name": "Foundation Year", "study_levels": ["Foundation"], "study_mode": "On-campus"},
                ]
            },
            "admission_categories": [
                _category("direct", "SAT/ACT Applicants", [{"id": "sat", "label": "SAT"}]),
                _category("foundation", "Foundation Year (NUET)", [{"id": "foundation", "label": "NUET"}]),
            ],
        }

        normalized = uni_service._normalize_university_schema(copy.deepcopy(row))
        categories = {
            str(category.get("id")): category
            for category in (normalized.get("admission_categories") or [])
            if isinstance(category, dict)
        }

        self.assertEqual(
            ["Computer Science", "Mechanical and Aerospace Engineering"],
            categories["direct"].get("applicable_majors"),
        )
        self.assertNotIn("foundation", categories)
        self.assertEqual(["Bachelor"], normalized.get("academics", {}).get("study_levels"))

    def test_explicit_category_majors_are_preserved(self):
        row = {
            "id": "explicit-demo",
            "name": "Explicit Demo",
            "academics": {
                "programs": [{"name": "Computer Science", "study_levels": ["Bachelor"], "study_mode": "On-campus"}]
            },
            "admission_categories": [
                _category(
                    "special",
                    "Special Category",
                    [{"id": "general", "label": "General"}],
                    applicable_majors=["Mechanical and Aerospace Engineering"],
                )
            ],
        }

        normalized = uni_service._normalize_university_schema(copy.deepcopy(row))
        category = (normalized.get("admission_categories") or [])[0]
        self.assertEqual(["Mechanical and Aerospace Engineering"], category.get("applicable_majors"))

    def test_normalize_schema_derives_requirement_profile_score_profile_from_official_program_percentiles(self):
        row = {
            "id": "cuhk-demo",
            "name": "CUHK Demo",
            "academics": {
                "acceptance_rate_percent": 31.83,
                "programs": [{"name": "Computer Science", "study_levels": ["Bachelor"], "study_mode": "On-campus"}],
                "admissions": {
                    "programs": [
                        {
                            "program_name": "Computer Science and Engineering",
                            "metric_unit": "weighted_total",
                            "source_scope": "program_admission_grade_profile",
                            "counts": {
                                "lower_quartile_weighted_total": 40.38,
                                "median_weighted_total": 42.88,
                                "upper_quartile_weighted_total": 44.5,
                            },
                            "provenance": {"confidence": "high", "source_url": "https://example.edu/admissions.pdf"},
                        }
                    ]
                },
            },
            "admission_categories": [
                _category(
                    "cuhk_hkdse",
                    "HKDSE (JUPAS)",
                    [
                        {
                            "id": "cuhk_hkdse",
                            "label": "HKDSE",
                            "requirements": {
                                "HKDSE_LEVEL": 3,
                                "HKDSE_WEIGHTED_TOTAL": 35,
                                "HKDSE_CHINESE_LANGUAGE": 3,
                                "HKDSE_ENGLISH_LANGUAGE": 3,
                                "HKDSE_MATHEMATICS": 2,
                            },
                            "applicable_majors": ["Computer Science"],
                        }
                    ],
                )
            ],
        }

        normalized = uni_service._normalize_university_schema(copy.deepcopy(row))
        profile = (normalized.get("admission_categories") or [])[0]["requirement_profiles"][0]
        score_profile = profile.get("score_profile") or {}

        self.assertEqual("weighted_total", score_profile.get("metric_id"))
        self.assertEqual("high", score_profile.get("confidence"))
        self.assertEqual(31.83, score_profile.get("acceptance_rate_percent"))
        self.assertEqual("HKDSE_WEIGHTED_TOTAL", score_profile.get("exam_id"))
        self.assertEqual(42.88, float((profile.get("stats_avg") or {}).get("HKDSE_WEIGHTED_TOTAL", 0.0)))

    def test_nu_dataset_uses_one_category_with_three_requirement_profiles(self):
        university = uni_service.get_university_by_id("nazarbayev-university-kaz-astana")
        self.assertIsNotNone(university)

        categories = university.get("admission_categories") or []
        self.assertEqual(1, len(categories))
        category = categories[0]
        profiles = {str(profile.get("id")): profile for profile in category.get("requirement_profiles") or []}

        self.assertEqual({"nu_sat_applicants", "nu_act_applicants", "nu_nuet_undergraduate"}, set(profiles))
        self.assertEqual(["SAT", "ACT", "NUET"], [profiles[key].get("label") for key in profiles])
        self.assertEqual(120, int((profiles["nu_nuet_undergraduate"].get("requirements") or {}).get("NUET", 0)))
        self.assertEqual(2, len(profiles["nu_nuet_undergraduate"].get("funding_options") or []))
        self.assertNotIn("admission_tracks", university)

    def test_dataset_keeps_score_profile_on_requirement_profile(self):
        mit = uni_service.get_university_by_id("mit-usa-cambridge")
        self.assertIsNotNone(mit)
        mit_profile = (mit.get("admission_categories") or [])[0]["requirement_profiles"][0].get("score_profile") or {}
        self.assertEqual("SAT", mit_profile.get("exam_id"))
        self.assertEqual(1520, mit_profile.get("p25_raw"))

        nu = uni_service.get_university_by_id("nazarbayev-university-kaz-astana")
        profiles = {
            str(profile.get("id")): profile
            for profile in (nu.get("admission_categories") or [])[0].get("requirement_profiles") or []
        }
        sat_profile = profiles["nu_sat_applicants"].get("score_profile") or {}
        self.assertEqual("SAT", sat_profile.get("exam_id"))
        self.assertEqual(1475, sat_profile.get("median_raw"))
        self.assertFalse(bool(profiles["nu_act_applicants"].get("score_profile")))


if __name__ == "__main__":
    unittest.main()

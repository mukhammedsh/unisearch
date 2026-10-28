import copy
import unittest

from app.services import admissions_catalog
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
    def test_oxford_program_category_uses_only_its_linked_program(self):
        university = uni_service.get_university_by_id("university-of-oxford-uk-oxford")
        self.assertIsNotNone(university)

        medicine = next(
            category
            for category in university.get("admission_categories") or []
            if category.get("id") == "oxford_ug_medicine"
        )

        self.assertEqual(["medicine_ug"], medicine.get("program_ids"))
        self.assertEqual(
            ["Medicine (Pre-clinical & Clinical)"],
            medicine.get("applicable_majors"),
        )
        self.assertNotIn("Computer Science", medicine.get("applicable_majors"))

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
        self.assertEqual(42.88, float(score_profile.get("median_raw") or 0.0))

    def test_nu_dataset_exposes_reviewed_offerings_without_retired_categories(self):
        uid = "nazarbayev-university-kaz-astana"
        university = uni_service.get_university_by_id(uid)
        self.assertEqual("reviewed", university["admissions_catalog"]["availability"])
        self.assertEqual(96, university["admissions_catalog"]["study_option_count"])
        self.assertNotIn("admission_categories", university)
        self.assertIn("preparation", university["academics"]["study_levels"])
        self.assertIn("residency", university["academics"]["study_levels"])
        self.assertNotIn("admission_tracks", university)

    def test_active_mit_first_year_keeps_test_presence_without_a_score_cutoff(self):
        resolved = admissions_catalog.resolve_context(
            "mit-usa-cambridge",
            context={
                "study_option_id": "mit-course-6-3-bachelor",
                "application_route_id": "mit-first-year",
                "study_level": "undergraduate",
                "applicant_route": "first_year",
                "intended_entry_cycle": "Fall 2027 entry",
            },
        )
        requirement = next(row for row in resolved["facts"] if row["id"] == "ug-sat-act-presence")
        self.assertEqual(["source-600fe783c80073e0"], requirement["source_ids"])
        self.assertEqual(["SAT", "ACT"], requirement["value"]["alternatives"])
        self.assertIsNone(requirement["value"]["cutoff"])
        self.assertFalse(uni_service.get_university_by_id("mit-usa-cambridge").get("admission_categories"))

        nu = admissions_catalog.resolve_context("nazarbayev-university-kaz-astana", context={
            "study_option_id": "nu-a-study-bachelor-of-science-in-computer-science",
            "application_route_id": "nu-a-route-regular-foundation-undergraduate", "study_level": "undergraduate",
            "applicant_route": "first_year", "intended_entry_cycle": "2027/28"})
        academic = next(row for row in nu["facts"] if row["id"] == "nu-a-fact-ug-academic-alternatives")
        sat_act = next(row for row in academic["value"]["routes"] if row["id"] == "sat_act")
        self.assertEqual({"digital_sat": 1240, "act": 26}, sat_act["minimum"])
        self.assertNotIn("score_profile", academic["value"])
        self.assertNotIn("nu-a-fact-nuet-support", {row["id"] for row in nu["facts"]})

    def test_choice_expansion_prefers_profile_admission_and_finance_metadata(self):
        categories = [
            _category(
                "course",
                "Course",
                [
                    {
                        "id": "sat",
                        "label": "SAT",
                        "published_admission": {
                            "rate_percent": 7,
                            "scope": "program",
                            "audience": "all",
                            "cycle": "2023-25",
                        },
                        "finance_override": {
                            "total_cost_year_usd": 20000,
                            "academic_year": "2027-28",
                        },
                    }
                ],
                published_admission={
                    "rate_percent": 20,
                    "scope": "institution",
                    "audience": "all",
                    "cycle": "2025",
                },
                finance_override={
                    "total_cost_year_usd": 30000,
                    "academic_year": "2026-27",
                },
            )
        ]

        choice = uni_service.expand_admission_choices(categories)[0]

        self.assertEqual(7, choice.get("published_admission", {}).get("rate_percent"))
        self.assertEqual("program", choice.get("published_admission", {}).get("scope"))
        self.assertEqual(20000, choice.get("finance_override", {}).get("total_cost_year_usd"))
        self.assertEqual("2027-28", choice.get("finance_override", {}).get("academic_year"))


if __name__ == "__main__":
    unittest.main()

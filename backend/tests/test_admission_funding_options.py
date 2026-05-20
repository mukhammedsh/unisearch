import copy
import unittest

from app.services import universities as uni_service


def _category(category_id, profiles, **extra):
    row = {
        "id": category_id,
        "label": "Direct Admission",
        "scope": "general",
        "program_ids": [],
        "program_names": [],
        "requirement_profiles": profiles,
    }
    row.update(extra)
    return row


class FundingOptionsTests(unittest.TestCase):
    def test_normalize_schema_keeps_requirement_profile_with_funding_options(self):
        row = {
            "id": "funding-options-demo",
            "name": "Funding Options Demo",
            "academics": {
                "programs": [{"name": "Computer Science", "study_levels": ["Bachelor"], "study_mode": "On-campus"}]
            },
            "admission_categories": [
                _category(
                    "direct",
                    [
                        {
                            "id": "sat",
                            "label": "SAT",
                            "requirements": {"GPA": 80},
                            "funding_options": [
                                {"id": "paid", "label": "Paid", "requirements": {"SAT": 1200}, "funding_type": "paid"},
                                {"id": "grant", "label": "Grant", "requirements": {"SAT": 1400}, "funding_type": "grant"},
                            ],
                        }
                    ],
                )
            ],
        }

        normalized = uni_service._normalize_university_schema(copy.deepcopy(row))
        category = (normalized.get("admission_categories") or [])[0]
        profile = category["requirement_profiles"][0]
        options = {str(option.get("id")): option for option in profile.get("funding_options") or []}

        self.assertEqual(["Computer Science"], category.get("applicable_majors"))
        self.assertEqual({"paid", "grant"}, set(options))
        self.assertEqual("paid", str(options["paid"].get("funding_type") or ""))
        self.assertEqual("grant", str(options["grant"].get("funding_type") or ""))

    def test_expand_admission_choices_flattens_profile_and_funding_requirements_for_scoring(self):
        categories = [
            _category(
                "direct",
                [
                    {
                        "id": "sat",
                        "label": "SAT",
                        "requirements": {"GPA": 80},
                        "funding_options": [
                            {"id": "paid", "label": "Paid", "requirements": {"SAT": 1200}, "funding_type": "paid"},
                            {"id": "grant", "label": "Grant", "requirements": {"SAT": 1400}, "funding_type": "grant"},
                        ],
                    }
                ],
            )
        ]

        choices = {str(choice.get("choiceKey") or choice.get("choice_key")): choice for choice in uni_service.expand_admission_choices(categories)}

        self.assertEqual({"direct::sat::paid", "direct::sat::grant"}, set(choices))
        self.assertEqual(80, int((choices["direct::sat::paid"].get("requirements") or {}).get("GPA", 0)))
        self.assertEqual(1200, int((choices["direct::sat::paid"].get("requirements") or {}).get("SAT", 0)))
        self.assertEqual(1400, int((choices["direct::sat::grant"].get("requirements") or {}).get("SAT", 0)))

    def test_real_dataset_exposes_nu_as_one_category_with_funding_options_per_profile(self):
        university = uni_service.get_university_by_id("nazarbayev-university-kaz-astana")
        self.assertIsNotNone(university)

        categories = university.get("admission_categories") or []
        self.assertEqual(1, len(categories))
        profiles = {str(profile.get("id")): profile for profile in categories[0].get("requirement_profiles") or []}

        self.assertEqual({"nu_sat_applicants", "nu_act_applicants", "nu_nuet_undergraduate"}, set(profiles))
        self.assertEqual(2, len(profiles["nu_sat_applicants"].get("funding_options") or []))
        self.assertEqual(1240, int((profiles["nu_sat_applicants"].get("requirements") or {}).get("SAT", 0)))
        self.assertEqual(26, int((profiles["nu_act_applicants"].get("requirements") or {}).get("ACT", 0)))
        self.assertEqual(1475, int((profiles["nu_sat_applicants"].get("stats_avg") or {}).get("SAT", 0)))
        self.assertFalse(bool(profiles["nu_act_applicants"].get("stats_avg")))


if __name__ == "__main__":
    unittest.main()

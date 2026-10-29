import copy
import unittest

from app.services import universities as uni_service, admissions_catalog


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
                            "requirements": {"GPA": 3.2},
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
                        "requirements": {"GPA": 3.2},
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
        self.assertEqual(3.2, float((choices["direct::sat::paid"].get("requirements") or {}).get("GPA", 0)))
        self.assertEqual(1200, int((choices["direct::sat::paid"].get("requirements") or {}).get("SAT", 0)))
        self.assertEqual(1400, int((choices["direct::sat::grant"].get("requirements") or {}).get("SAT", 0)))

    def test_expand_admission_choices_without_funding_options_preserves_single_choice(self):
        categories = [
            _category(
                "direct",
                [
                    {
                        "id": "regular_admission",
                        "label": "Regular Admission",
                        "requirements": {"GPA": 3.4, "SAT": 1300},
                    }
                ],
            )
        ]
        choices = uni_service.expand_admission_choices(categories)
        self.assertEqual(1, len(choices))
        choice = choices[0]
        self.assertEqual("direct::regular_admission", str(choice.get("choiceKey") or choice.get("choice_key")))
        self.assertEqual(3.4, float((choice.get("requirements") or {}).get("GPA", 0)))
        self.assertEqual(1300, int((choice.get("requirements") or {}).get("SAT", 0)))

    def test_expand_admission_choices_funding_requirements_override_profile(self):
        categories = [
            _category(
                "cat_stem",
                [
                    {
                        "id": "track_sat",
                        "label": "SAT Track",
                        "requirements": {"SAT": 1200, "GPA": 3.0},
                        "funding_options": [
                            {"id": "merit_grant", "label": "Full Merit Grant", "requirements": {"SAT": 1450}, "funding_type": "grant"},
                        ],
                    }
                ],
            )
        ]
        choices = uni_service.expand_admission_choices(categories)
        self.assertEqual(1, len(choices))
        choice = choices[0]
        self.assertEqual("cat_stem::track_sat::merit_grant", str(choice.get("choiceKey") or choice.get("choice_key")))
        # Funding option SAT requirement (1450) overrides profile SAT requirement (1200), GPA is preserved (3.0)
        self.assertEqual(1450, int((choice.get("requirements") or {}).get("SAT", 0)))
        self.assertEqual(3.0, float((choice.get("requirements") or {}).get("GPA", 0)))

    def test_reviewed_nu_separates_admission_from_financial_support(self):
        uid = "nazarbayev-university-kaz-astana"
        university = uni_service.get_university_by_id(uid)
        self.assertNotIn("admission_categories", university)
        institution = admissions_catalog.get_institution(uid)
        regular = next(row for row in institution["application_routes"] if row["id"] == "nu-a-route-regular-foundation-undergraduate")
        support = next(row for row in institution["application_routes"] if row["id"] == "nu-a-route-financial-support")
        self.assertNotEqual(regular["id"], support["id"])
        self.assertEqual("financial_support_application", support["classification"])
        flow = next(row for row in institution["facts"] if row["id"] == "nu-a-fact-financial-sequence")
        self.assertTrue(flow["source_ids"])
        self.assertIn("offer", str(flow["value"]).lower())
        self.assertEqual(120, next(row for row in institution["facts"] if row["id"] == "nu-a-fact-nuet-support")["value"]["NUET_total"])


if __name__ == "__main__":
    unittest.main()

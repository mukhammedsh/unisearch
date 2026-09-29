import unittest

from app.services.ai_scoring import sort_universities_ai


FACTORS = {
    "practice_vs_science": 0.5,
    "social_vs_hardcore": 0.5,
    "budget_vs_prestige": 0.5,
    "city_vs_campus": 0.5,
}


def university(uid, cost, *, requirements=None, funding_options=None, rank=10):
    profile = {"id": "entry", "label": "Entry", "requirements": requirements or {}}
    if funding_options:
        profile["funding_options"] = funding_options
    return {
        "id": uid,
        "name": uid,
        "rank": rank,
        "factors": FACTORS,
        "finance": {"total_cost_year_usd": cost, "currency": "USD"} if cost is not None else {},
        "admission_categories": [
            {"id": "undergraduate", "label": "Undergraduate", "study_levels": ["bachelor"], "requirement_profiles": [profile]}
        ],
    }


class UniFitBudgetPolicyTests(unittest.TestCase):
    def setUp(self):
        self.profile = {
            "studyLevel": "bachelor",
            "exams": [{"id": "SAT", "score": 1300}],
        }

    def test_known_over_budget_cost_lowers_rank_without_hiding_option(self):
        expensive = university("expensive", 30000, requirements={"SAT": 1200}, rank=1)
        affordable = university("affordable", 15000, requirements={"SAT": 1200}, rank=100)

        low_budget = sort_universities_ai([expensive, affordable], {**self.profile, "budget": 20000})
        self.assertEqual(["affordable", "expensive"], [row["id"] for row in low_budget])
        self.assertEqual("over_budget", low_budget[1]["matchData"]["budgetStatus"])
        self.assertGreater(low_budget[1]["matchData"]["finalScore"], low_budget[0]["matchData"]["finalScore"])

        high_budget = sort_universities_ai([expensive, affordable], {**self.profile, "budget": 40000})
        self.assertEqual(["expensive", "affordable"], [row["id"] for row in high_budget])
        self.assertTrue(all(row["matchData"]["budgetStatus"] == "within_budget" for row in high_budget))

    def test_possible_grant_does_not_reduce_cost_and_unknown_is_not_zero(self):
        grant = university(
            "grant",
            30000,
            requirements={"SAT": 1200},
            funding_options=[
                {"id": "award", "label": "Potential award", "funding_type": "grant", "finance_override": {"total_cost_year_usd": 0}}
            ],
        )
        unknown = university("unknown", None, requirements={"SAT": 1200})
        results = sort_universities_ai([grant, unknown], {**self.profile, "budget": 20000})
        by_id = {row["id"]: row["matchData"] for row in results}

        self.assertEqual(30000, by_id["grant"]["finalPriceUSD"])
        self.assertEqual("over_budget", by_id["grant"]["budgetStatus"])
        self.assertIsNone(by_id["grant"]["grantPotential"])
        self.assertIsNone(by_id["unknown"]["finalPriceUSD"])
        self.assertEqual("unknown_cost", by_id["unknown"]["budgetStatus"])
        self.assertIsNone(by_id["unknown"]["affordabilityGap"])

    def test_missing_academic_evidence_has_no_neutral_fifty_percent(self):
        known = university("known", 15000, requirements={"SAT": 1200}, rank=100)
        unscored = university("unscored", 15000, rank=1)
        results = sort_universities_ai([unscored, known], {**self.profile, "budget": 20000})
        by_id = {row["id"]: row["matchData"] for row in results}

        self.assertIsNone(by_id["unscored"]["requirementsFitPercent"])
        self.assertIsNone(by_id["unscored"]["requirementsGap"])
        self.assertEqual(100, by_id["known"]["requirementsFitPercent"])
        self.assertEqual("known", results[0]["id"])


if __name__ == "__main__":
    unittest.main()

"""UniFit preference sliders: fixed-anchor university indicators and slider weighting."""
import unittest

from app.services import preference_factors as pf
from app.services.ai_scoring import _extract_university_factors, _preference_mismatch, sort_universities_ai


def _university(uid, **fields):
    return {"id": uid, "name": uid, **fields}


class PreferenceFactorScalesTests(unittest.TestCase):
    def test_location_uses_oecd_urban_area_anchors_on_a_log_scale(self):
        def at(population):
            return pf.location({"factors_meta": {"raw_metrics": {"city": {"population": population}}}})

        self.assertEqual(at(20_000), 1.0)  # below the 50,000 minimum urban-area size
        self.assertEqual(at(50_000), 1.0)
        self.assertEqual(at(1_500_000), 0.0)  # large metropolitan threshold
        self.assertEqual(at(9_000_000), 0.0)
        # A city of 1.3 million is close to the metropolitan end, not "outside a city" as the earlier linear scale had it.
        self.assertLess(at(1_300_000), 0.1)
        self.assertAlmostEqual(at(273_861), 0.5, places=3)  # geometric middle of the anchors
        self.assertIsNone(pf.location({}))

    def test_location_prefers_the_official_urban_area_over_the_city(self):
        # Stanford's own census place has about 14,000 people, but the campus sits in the San Francisco (Greater) FUA.
        campus = {"factors_meta": {"raw_metrics": {"city": {"population": 13_809},
                                                   "urban_area": {"population": 6_643_970, "source_url": "https://sdmx.oecd.org"}}}}
        self.assertEqual(pf.location(campus), 0.0)
        official_city = {"factors_meta": {"raw_metrics": {"city": {"population": 345_604, "population_official_fallback": 1_612_500}}}}
        self.assertEqual(pf.location(official_city), 0.0)

    def test_cost_vs_prestige_averages_known_parts_on_fixed_scales(self):
        ranked = {"rank": 1, "rank_meta": {"status": "official"}}
        self.assertEqual(pf.cost_vs_prestige(ranked, 100_000), 1.0)
        self.assertEqual(pf.cost_vs_prestige(ranked), 1.0)  # rank only
        self.assertEqual(pf.cost_vs_prestige({}, 1_000), 0.0)  # cost only
        self.assertAlmostEqual(pf.cost_vs_prestige({"rank": 1000, "rank_meta": {"status": "official"}}, 10_000), 0.25)
        # An unofficial rank is ignored, and nothing known stays unknown.
        self.assertIsNone(pf.cost_vs_prestige({"rank": 5, "rank_meta": {"status": "estimated"}}))

    def test_selectivity_is_applicants_per_place_and_prefers_reviewed_statistics(self):
        reviewed = {"admission_statistics": {"rate_percent": 4.6}, "academics": {"acceptance_rate_percent": 50}}
        self.assertAlmostEqual(pf.selectivity(reviewed), 0.8347, places=3)  # 21.7 applicants per place, not the 50% field
        self.assertEqual(pf.selectivity({"academics": {"acceptance_rate_percent": 100}}), 0.0)
        self.assertEqual(pf.selectivity({"academics": {"acceptance_rate_percent": 2.5}}), 1.0)
        self.assertEqual(pf.selectivity({"academics": {"acceptance_rate_percent": 1}}), 1.0)
        # First-year admission rates say nothing about graduate entry, and a missing rate stays unknown.
        self.assertIsNone(pf.selectivity(reviewed, "master"))
        self.assertIsNone(pf.selectivity({}))
        self.assertIsNone(pf.selectivity({"academics": {"acceptance_rate_percent": 0}}))

    def test_research_intensity_divides_output_by_enrolment(self):
        def at(works, students):
            return pf.research_intensity({"student_count": students, "factors_meta": {"raw_metrics": {"openalex": {"works_count": works}}}})

        # Same output, ten times the students: clearly less research-intensive.
        self.assertGreater(at(300_000, 10_000), at(300_000, 100_000))
        self.assertEqual(at(300_000, 10_000), 1.0)
        self.assertEqual(at(500, 10_000), 0.0)
        # An unmatched OpenAlex record (zero works) or a missing enrolment is unknown, not "practice-focused".
        self.assertIsNone(at(0, 10_000))
        self.assertIsNone(at(300_000, None))

    def test_stored_values_win_and_graduate_levels_drop_selectivity(self):
        uni = _university("u-stored", factors={"practice_vs_science": 0.3, "social_vs_hardcore": 0.8, "city_vs_campus": None},
                          factors_meta={"raw_metrics": {"city": {"population": 20_000}}})
        bachelor = _extract_university_factors(uni, "bachelor")
        self.assertEqual(bachelor["practice_vs_science"], 0.3)
        self.assertEqual(bachelor["social_vs_hardcore"], 0.8)
        self.assertIsNone(bachelor["city_vs_campus"])  # an explicit null stays unknown
        self.assertIsNone(_extract_university_factors(uni, "master")["social_vs_hardcore"])


class PreferenceWeightingTests(unittest.TestCase):
    def test_centred_sliders_express_no_preference(self):
        factors = {"practice_vs_science": 1.0, "social_vs_hardcore": 1.0, "budget_vs_prestige": 1.0, "city_vs_campus": 1.0}
        mismatch, _ = _preference_mismatch({key: 0.5 for key in factors}, factors)
        self.assertIsNone(mismatch)

    def test_only_moved_sliders_count_weighted_by_distance_from_centre(self):
        user = {"practice_vs_science": 1.0, "social_vs_hardcore": 0.75, "budget_vs_prestige": 0.5, "city_vs_campus": 0.5}
        factors = {"practice_vs_science": 0.8, "social_vs_hardcore": 0.25, "budget_vs_prestige": 0.0, "city_vs_campus": 0.0}
        mismatch, deltas = _preference_mismatch(user, factors)
        # Weights 1.0 and 0.5; the centred sliders are ignored however far the university is from the centre.
        self.assertAlmostEqual(mismatch, (1.0 * 0.2 + 0.5 * 0.5) / 1.5)
        self.assertAlmostEqual(deltas["budget_vs_prestige"], 0.5)

    def test_unknown_university_values_count_as_a_typical_university(self):
        user = {"practice_vs_science": 1.0, "social_vs_hardcore": 0.5, "budget_vs_prestige": 0.5, "city_vs_campus": 0.0}
        mismatch, deltas = _preference_mismatch(user, {"practice_vs_science": None, "social_vs_hardcore": 0.5,
                                                       "budget_vs_prestige": 0.5, "city_vs_campus": 0.1})
        # Unknown research focus at a slider of 1.0 counts as 0.5, the mean distance to a uniform scale; a missing
        # value must not let the known location decide alone.
        self.assertAlmostEqual(mismatch, (0.5 + 0.1) / 2)
        complete, _ = _preference_mismatch(user, {"practice_vs_science": 0.9, "social_vs_hardcore": 0.5,
                                                  "budget_vs_prestige": 0.5, "city_vs_campus": 0.1})
        self.assertLess(complete, mismatch)
        self.assertIsNone(deltas["practice_vs_science"])
        self.assertIsNone(_preference_mismatch(user, {key: None for key in user})[0])

    def test_neutral_sliders_rank_by_other_evidence_and_unknown_fit_follows_known_fit(self):
        def uni(uid, rank, population):
            return _university(uid, rank=rank, finance={"total_cost_year_usd": 20000},
                               factors={"practice_vs_science": 0.9, "social_vs_hardcore": 0.9, "budget_vs_prestige": 0.9},
                               factors_meta={"raw_metrics": {"city": {"population": population}}} if population else {})

        items = [uni("u-unknown-city", 1, None), uni("u-big-city", 2, 5_000_000), uni("u-campus-town", 3, 30_000)]
        neutral = sort_universities_ai(items, profile={}, funding_type="any")
        self.assertEqual([row["id"] for row in neutral], ["u-unknown-city", "u-big-city", "u-campus-town"])  # rank order
        self.assertTrue(all(row["matchData"]["preferenceMismatch"] is None for row in neutral))
        self.assertTrue(all(row["matchData"]["uiBadgeHints"]["vibe"] == "" for row in neutral))

        outside = sort_universities_ai(items, profile={}, city_vs_campus=100, funding_type="any")
        self.assertEqual([row["id"] for row in outside], ["u-campus-town", "u-big-city", "u-unknown-city"])
        self.assertEqual(outside[0]["matchData"]["uiBadgeHints"]["vibe"], "your_vibe")



class RefreshScriptSourcesTests(unittest.TestCase):
    def test_every_urban_area_and_stored_factor_input_is_sourced(self):
        import json
        import sys
        from pathlib import Path

        backend = Path(__file__).resolve().parents[1]
        sys.path.insert(0, str(backend / "scripts"))
        import refresh_university_factors as refresh

        for uid, area in refresh.OFFICIAL_URBAN_AREA_POPULATION.items():
            self.assertTrue(area["source"] and area["source_url"].startswith("https://"), uid)
            self.assertGreater(area["population"], 0, uid)
        universities = json.loads((backend / "data" / "universities.json").read_text(encoding="utf-8"))
        ids = {row["id"] for row in universities}
        self.assertLessEqual(set(refresh.OFFICIAL_URBAN_AREA_POPULATION), ids)
        for row in universities:
            # Stored factors match what the shared scales give for the stored raw metrics.
            self.assertEqual(row["factors"]["city_vs_campus"], pf.location(row), row["id"])
            self.assertEqual(row["factors"]["practice_vs_science"], pf.research_intensity(row), row["id"])


if __name__ == "__main__":
    unittest.main()

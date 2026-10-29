import copy
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.services import admissions_catalog, universities


MIT = "mit-usa-cambridge"
IMPERIAL = "imperial-college-london-uk"
STANFORD = "stanford-university-usa-ca"


class CatalogCostTests(unittest.TestCase):
    def test_program_price_is_visible_without_becoming_an_annual_budget(self):
        fact = {"id": "finance-fee", "publication_status": "published", "review_status": "verified",
                "source_ids": ["official"], "scope": {"option_ids": ["finance"], "route_ids": [], "levels": ["masters"]},
                "value": {}, "attributes": {"catalog_costs": {"quotes": [{"basis": "tuition", "amount": 14000,
                    "currency": "USD", "billing_period": "whole_program", "period_label": "Whole program"}]}}}
        institution = {"study_options": [{"id": "finance", "title": "Master of Science in Finance", "levels": ["masters"]}],
                       "application_routes": [], "facts": [fact], "sources": [{"id": "official", "url": "https://nu.edu.kz/"}]}
        with patch.object(admissions_catalog, "get_institution", return_value=institution):
            costs = admissions_catalog.catalog_costs("nu", "masters", study_option_id="finance")
        self.assertEqual(14000, costs["tuition"]["min"])
        self.assertFalse(costs["tuition"]["annual_comparable"])
        self.assertEqual("whole_program", costs["tuition"]["billing_period"])
        self.assertIsNone(costs["annual_total"])
        self.assertIsNone(universities._catalog_cost_range_usd({"catalog_costs": costs}, "tuition"))
        fact["attributes"]["catalog_costs"]["quotes"][0].update(billing_period="academic_year", period_label="Academic year")
        with patch.object(admissions_catalog, "get_institution", return_value=institution):
            self.assertIsNone(admissions_catalog.catalog_costs("nu", "masters", study_mode="online")["tuition"])
            fact["attributes"]["catalog_costs"]["quotes"][0]["study_modes"] = ["online"]
            online = admissions_catalog.catalog_costs("nu", "masters", study_mode="online")
        self.assertTrue(online["tuition"]["annual_comparable"])

    def test_reviewed_prices_keep_scope_period_and_excluded_costs(self):
        mit = admissions_catalog.catalog_costs(MIT)
        self.assertEqual(92760, mit["annual_total"]["min"])
        self.assertEqual(66720, mit["tuition"]["min"])
        self.assertEqual("2026-2027", mit["annual_total"]["period"])
        self.assertEqual("", mit["annual_total"]["study_level"])
        self.assertEqual(["undergraduate"], mit["annual_total"]["levels"])
        self.assertIn("insurance", mit["annual_total"]["exclusions"])
        stanford = admissions_catalog.catalog_costs(STANFORD)
        self.assertEqual(97545, stanford["annual_total"]["min"])
        self.assertEqual(67731, stanford["tuition"]["min"])
        self.assertIn("one_time_fees", stanford["annual_total"]["exclusions"])

    def test_imperial_does_not_sum_different_years_or_use_placement_year_fees(self):
        costs = admissions_catalog.catalog_costs(IMPERIAL)
        self.assertIsNone(costs["annual_total"])
        self.assertEqual(10050, costs["tuition"]["min"])
        self.assertGreaterEqual(costs["tuition"]["max"], 47800)
        self.assertEqual("2027 entry", costs["tuition"]["period"])
        self.assertEqual(["Home fee", "Overseas fee"], costs["tuition"]["fee_statuses"])

    def test_level_and_mode_do_not_borrow_undergraduate_or_campus_budgets(self):
        self.assertIsNone(admissions_catalog.catalog_costs(MIT, "masters")["annual_total"])
        self.assertIsNone(admissions_catalog.catalog_costs(STANFORD, "doctoral")["annual_total"])
        self.assertIsNone(admissions_catalog.catalog_costs(MIT, study_mode="online")["annual_total"])

    def test_price_basis_drives_card_filters_and_sort_without_restoring_legacy_finance(self):
        client = TestClient(app)
        tuition = client.get("/universities", params={"q": "MIT", "max_tuition": 70000, "cost_basis": "tuition"})
        total = client.get("/universities", params={"q": "MIT", "max_tuition": 70000, "cost_basis": "annual_total"})
        self.assertEqual(200, tuition.status_code)
        self.assertIn(MIT, [row["id"] for row in tuition.json()["items"]])
        self.assertNotIn(MIT, [row["id"] for row in total.json()["items"]])
        card = next(row for row in tuition.json()["items"] if row["id"] == MIT)
        self.assertNotIn("finance", card)
        self.assertEqual(66720, card["catalog_costs"]["tuition"]["min"])
        self.assertEqual(422, client.get("/universities?cost_basis=net_after_aid").status_code)

    def test_discrete_tariffs_do_not_fill_gaps_and_unknown_costs_do_not_pass(self):
        with patch("app.services.currency.convert", side_effect=lambda amount, _source, _target: amount * 1.25):
            rows = universities.list_universities(q="Imperial", max_tuition=20000, cost_basis="tuition")["items"]
            gap = universities.list_universities(q="Imperial", study_level="undergraduate", min_tuition=20000, max_tuition=30000, cost_basis="tuition")["items"]
        self.assertIn(IMPERIAL, [row["id"] for row in rows])
        self.assertNotIn(IMPERIAL, [row["id"] for row in gap])
        unknown = universities.list_universities(q="Imperial", max_tuition=1000000)["items"]
        self.assertNotIn(IMPERIAL, [row["id"] for row in unknown])

    def test_profiled_ranges_filter_individual_prices_and_living_intervals(self):
        costs = admissions_catalog.catalog_costs(IMPERIAL, "undergraduate", profile={})
        self.assertEqual([10050, 44850, 47800], costs["tuition"]["amounts"])
        self.assertEqual((26442, 64842), (costs["annual_total"]["min"], costs["annual_total"]["max"]))
        self.assertEqual(3, len(costs["annual_total"]["intervals"]))
        home = admissions_catalog.catalog_costs(IMPERIAL, "undergraduate", profile={"fee_status_context": "self_reported_home_domestic"})
        self.assertEqual([10050], home["tuition"]["amounts"])

        with patch("app.services.currency.convert", side_effect=lambda amount, _source, _target: amount * 1.25):
            affordable = universities.list_universities(
                q="Imperial", study_level="undergraduate", profile={}, max_tuition=40000, cost_basis="annual_total")["items"]
            gap = universities.list_universities(
                q="Imperial", study_level="undergraduate", profile={}, min_tuition=40000, max_tuition=60000, cost_basis="annual_total")["items"]
        self.assertIn(IMPERIAL, [row["id"] for row in affordable])
        self.assertNotIn(IMPERIAL, [row["id"] for row in gap])

        points = TestClient(app).post("/universities/profiled", json={
            "q": "Imperial", "study_level": "undergraduate", "fields": "map", "profile": {}, "limit": 10,
        })
        self.assertEqual(200, points.status_code)
        imperial = next(row for row in points.json()["items"] if row["id"] == IMPERIAL)
        self.assertEqual(26442, imperial["catalog_costs"]["annual_total"]["min"])

    def test_explicit_overseas_status_cannot_pass_through_home_tariff(self):
        client = TestClient(app)
        params = {"q": "Imperial", "study_level": "undergraduate", "max_tuition": 20000,
                  "cost_basis": "tuition", "fee_status_context": "self_reported_international_overseas"}
        with patch("app.services.currency.convert", side_effect=lambda amount, _source, _target: amount * 1.25):
            for path in ("/universities", "/universities/map-points"):
                query = {**params, **({"west": -180, "east": 180, "south": -90, "north": 90} if "map" in path else {})}
                response = client.get(path, params=query)
                self.assertEqual(200, response.status_code)
                self.assertNotIn(IMPERIAL, [row["id"] for row in response.json()["items"]])
            response = client.post("/universities/ai-sort", json={
                "q": "Imperial", "max_tuition": 20000, "cost_basis": "tuition",
                "profile": {"study_level": "undergraduate", "major": "computer science", "fee_status_context": params["fee_status_context"]},
            })
            self.assertEqual(200, response.status_code)
            self.assertNotIn(IMPERIAL, [row["id"] for row in response.json()["items"]])
        self.assertEqual(422, client.get("/universities?fee_status_context=Overseas").status_code)

    def test_subject_level_fee_and_cycle_narrow_one_projection_without_program_selection(self):
        costs = admissions_catalog.catalog_costs(IMPERIAL, "masters", major="computer science",
            fee_status_context="self_reported_international_overseas", intended_entry_cycle="Fall 2027")
        self.assertIsNone(costs["annual_total"])
        self.assertEqual(48300, costs["tuition"]["min"])
        self.assertEqual(["Overseas fee"], costs["tuition"]["fee_statuses"])
        self.assertEqual("matched", costs["tuition"]["cycle_status"])
        self.assertTrue(costs["scope"]["option_ids"])
        self.assertIsNone(admissions_catalog.catalog_costs(IMPERIAL, "undergraduate", major="law")["tuition"])
        self.assertEqual("dated_reference", admissions_catalog.catalog_costs(MIT, "undergraduate", intended_entry_cycle="Fall 2028")["annual_total"]["cycle_status"])
        self.assertEqual("matched", admissions_catalog.catalog_costs(MIT, "undergraduate", intended_entry_cycle="Fall 2026")["annual_total"]["cycle_status"])

    def test_all_levels_do_not_silently_choose_undergraduate_and_band_match_is_partial(self):
        costs = admissions_catalog.catalog_costs(IMPERIAL)
        self.assertEqual("", costs["tuition"]["study_level"])
        self.assertIn("masters", costs["tuition"]["levels"])
        self.assertIn("undergraduate", costs["tuition"]["levels"])
        profiled = admissions_catalog.catalog_costs(IMPERIAL, profile={})
        self.assertIn("masters", profiled["tuition"]["levels"])
        self.assertIsNone(profiled["annual_total"])
        with patch("app.services.currency.convert", side_effect=lambda amount, _source, _target: amount):
            result = universities.list_universities(q="Imperial", study_level="undergraduate", max_tuition=20000, cost_basis="tuition")
        quote = next(row for row in result["items"] if row["id"] == IMPERIAL)["catalog_costs"]["tuition"]
        self.assertEqual("partial", quote["filter_match"])
        self.assertEqual("unknown", quote["fee_status_match"])

    def test_invalid_saved_selection_and_unmatched_subject_do_not_borrow_general_prices(self):
        for selection in ({"studyOptionId": "retired-option"}, {"applicationRouteId": "retired-route"},
                          {"studyOptionId": "mit-course-6-3-bachelor", "applicationRouteId": "mit_grad_physics_admissions"}):
            costs = admissions_catalog.catalog_costs(MIT, profile={"study_level": "undergraduate", "selectedAdmissionChoices": {MIT: selection}})
            self.assertIsNone(costs["annual_total"])
            self.assertIsNone(costs["tuition"])
        scoped = admissions_catalog.catalog_costs(MIT, profile={"study_level": "masters", "selectedAdmissionChoices": {MIT: {"studyOptionId": "mit-course-6-3-bachelor"}}})
        self.assertIsNone(scoped["annual_total"])

    def test_legacy_zero_and_native_currency_are_preserved(self):
        free = {"id": "free", "finance": {"currency": "USD", "total_cost_year_usd": 0, "costs_breakdown_year_usd": {"Tuition": 0}}}
        self.assertEqual((0, 0), universities._catalog_cost_range_usd(free, "tuition"))
        gbp = {"id": "gbp", "finance": {"currency": "GBP", "total_cost_year_usd": 200, "costs_breakdown_year_usd": {"Tuition": 100}}}
        before = copy.deepcopy(gbp)
        with patch("app.services.currency.convert", side_effect=lambda amount, _source, _target: amount * 2):
            self.assertEqual((200, 200), universities._catalog_cost_range_usd(gbp, "tuition"))
        self.assertEqual(before, gbp)
        self.assertIsNone(universities._catalog_cost_range_usd({"id": "invalid", "finance": {"total_cost_year_usd": -10}}))
        self.assertIsNone(universities._catalog_cost_range_usd({"id": "unknown-currency", "finance": {"total_cost_year_min": 1000, "total_cost_year_max": 2000}}))

    def test_map_and_ai_sort_keep_the_same_filtered_reference_without_personal_scoring(self):
        client = TestClient(app)
        points = client.get("/universities/map-points", params={
            "west": -180, "east": 180, "south": -90, "north": 90, "q": "MIT", "max_tuition": 70000, "cost_basis": "tuition",
        })
        self.assertEqual(200, points.status_code)
        point = next(row for row in points.json()["items"] if row["id"] == MIT)
        self.assertEqual(66720, point["catalog_costs"]["tuition"]["min"])
        response = client.post("/universities/ai-sort", json={"q": "MIT", "max_tuition": 70000, "cost_basis": "tuition", "profile": {}})
        self.assertEqual(200, response.status_code)
        card = next(row for row in response.json()["items"] if row["id"] == MIT)
        self.assertEqual(92760, card["catalog_costs"]["annual_total"]["min"])
        self.assertIsNone(card["matchData"]["affordabilityGap"])

    def test_sort_uses_selected_basis_with_unknown_last_and_zero_first(self):
        total_first = {"id": "a", "finance": {"currency": "USD", "total_cost_year_usd": 100, "costs_breakdown_year_usd": {"Tuition": 90}}}
        tuition_first = {"id": "b", "finance": {"currency": "USD", "total_cost_year_usd": 200, "costs_breakdown_year_usd": {"Tuition": 50}}}
        unknown = {"id": "unknown"}
        free = {"id": "free", "finance": {"currency": "USD", "total_cost_year_usd": 0, "costs_breakdown_year_usd": {"Tuition": 0}}}
        self.assertEqual(["free", "a", "b", "unknown"], [row["id"] for row in universities._apply_sort([unknown, total_first, free, tuition_first], "tuition_asc")])
        self.assertEqual(["free", "b", "a", "unknown"], [row["id"] for row in universities._apply_sort([unknown, total_first, free, tuition_first], "tuition_asc", cost_basis="tuition")])

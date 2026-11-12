import unittest

from app.services import admissions_assessment, admissions_catalog

IMPERIAL = "imperial-college-london-uk"
STANFORD = "stanford-university-usa-ca"
MIT = "mit-usa-cambridge"
STANFORD_FIRST_YEAR = "undergraduate-shared-evidence:stanford-first-year"
STANFORD_TRANSFER = "undergraduate-shared-evidence:stanford-transfer"
GRADUATE_LEVELS = {"masters", "doctoral", "professional", "residency"}
# Shared graduate application pages that list no study option; vocabulary.json declares their category by route ID.
SHARED_GRADUATE_ROUTES = {"undergraduate-shared-evidence:stanford-nonprofessional-graduate", "undergraduate-shared-evidence:stanford-knight-hennessy"}
# Open routes that serve a different audience than any single category: graduates entering a first-degree course
# through UCAS, and external medical students taking an intercalated BSc.
OPEN_ROUTES_WITHOUT_CATEGORY = {"procedure-medicine-graduate-entry", "procedure-imperial_intercalated_bsc_external_uk_irish"}


class ApplicantRouteImpliedByRouteTests(unittest.TestCase):
    def test_every_reviewed_route_implies_a_category_or_is_not_applicable(self):
        for institution_id in sorted(admissions_catalog.INSTITUTION_IDS):
            institution = admissions_catalog.get_institution(institution_id)
            levels = {option["id"]: set(option["levels"]) for option in institution["study_options"]}
            for route in institution["application_routes"]:
                category = route["applicant_route"]
                route_levels = {level for option_id in route["option_ids"] for level in levels[option_id]}
                with self.subTest(route=route["id"]):
                    if category == "graduate":
                        self.assertTrue(route_levels <= GRADUATE_LEVELS and (route_levels or route["id"] in SHARED_GRADUATE_ROUTES), route_levels)
                    elif category in ("first_year", "transfer"):
                        self.assertTrue(route_levels <= {"undergraduate", "preparation", "non_degree"}, route_levels)
                    elif route["entry"] in ("external", "external_restricted"):
                        self.assertIn(route["id"], OPEN_ROUTES_WITHOUT_CATEGORY)
                    else:
                        self.assertIsNone(category)

    def test_imperial_undergraduate_ucas_routes_are_first_year_entry(self):
        routes = admissions_catalog.get_institution(IMPERIAL)["application_routes"]
        ucas = [route for route in routes if route["classification"] == "ucas_course_choice"]
        self.assertEqual(72, len(ucas))
        self.assertEqual({"first_year"}, {route["applicant_route"] for route in ucas if route["id"] != "procedure-medicine-graduate-entry"})
        self.assertIsNone(next(route for route in ucas if route["id"] == "procedure-medicine-graduate-entry")["applicant_route"])

    def test_imperial_first_year_mappings_run_with_only_option_and_route_selected(self):
        records = [row for (institution_id, _), row in admissions_assessment._annotations()[0].items()
                   if institution_id == IMPERIAL and row["scope"]["applicant_routes"] == ["first_year"]]
        self.assertEqual(5, len(records))
        institution = admissions_catalog.get_institution(IMPERIAL)
        options = {option["id"]: option for option in institution["study_options"]}
        routes = {route["id"]: route for route in institution["application_routes"]}
        for record in records:
            for option_id in record["scope"]["option_ids"]:
                route_id = next(route_id for route_id in options[option_id]["route_ids"] if routes[route_id]["applicant_route"] == "first_year")
                with self.subTest(record=record["id"], option=option_id):
                    resolved = admissions_catalog.resolve_context(IMPERIAL, context={
                        "study_option_id": option_id, "application_route_id": route_id, "study_level": "undergraduate",
                        "intended_entry_cycle": record["scope"]["cycles"][0]})
                    self.assertEqual("first_year", resolved["context"]["applicant_route"])
                    checks = [row for row in admissions_assessment.assess_resolved_context(resolved, {})["choices"][0]["details"]["checks"]
                              if row["factId"] == record["fact_id"] and "checkId" in row]
                    self.assertEqual({check["id"] for check in record["checks"]}, {check["checkId"] for check in checks})
                    self.assertNotIn("unassessed", {check["status"] for check in checks})

    def test_stanford_first_year_and_transfer_routes_own_their_records_without_a_request_category(self):
        def resolve(route_id):
            return admissions_catalog.resolve_context(STANFORD, context={
                "study_option_id": "stanford-option-cs-bs", "application_route_id": route_id,
                "study_level": "undergraduate", "intended_entry_cycle": "Fall 2027"})

        def transfer_ids(resolved):
            # Dated history keeps its own entries, so count current and historical records together.
            rows = [row for key in ("facts", "unknowns") for row in (*resolved[key], *resolved["history"][key])]
            return {row["id"] for row in rows if row["scope"]["applicant_categories"] == ["transfer"]}

        first_year, transfer = resolve(STANFORD_FIRST_YEAR), resolve(STANFORD_TRANSFER)
        self.assertEqual(("first_year", "transfer"), (first_year["context"]["applicant_route"], transfer["context"]["applicant_route"]))
        self.assertEqual(set(), transfer_ids(first_year))
        self.assertEqual(11, len(transfer_ids(transfer)))
        self.assertIn("applicant", {key for key, value in first_year["context_applicability"].items() if value == "matched"})

    def test_route_implied_category_governs_defaults_and_reports_a_contradicting_request(self):
        selection = {"studyOptionId": "stanford-option-cs-bs", "applicationRouteId": STANFORD_FIRST_YEAR,
                     "studyLevel": "undergraduate", "applicantRoute": "transfer", "intendedEntryCycle": "Fall 2027"}
        profile = {"applicant_route": "graduate", "selectedAdmissionChoices": {STANFORD: selection}}
        # A profile or saved-selection value is a default: the route replaces it without a complaint.
        resolved = admissions_catalog.resolve_context(STANFORD, profile)
        self.assertEqual("first_year", resolved["context"]["applicant_route"])
        self.assertEqual("matched", resolved["context_applicability"]["applicant"])
        self.assertTrue(resolved["facts"])
        self.assertEqual("first_year", admissions_catalog.resolve_context(STANFORD, profile, {"applicant_route": "first_year"})["context"]["applicant_route"])
        # A category named by the request itself that contradicts the route is reported, never applied.
        contradicting = admissions_catalog.resolve_context(STANFORD, profile, {"applicant_route": "transfer"})
        self.assertEqual("first_year", contradicting["context"]["applicant_route"])
        self.assertEqual("mismatched", contradicting["context_applicability"]["applicant"])
        self.assertEqual([], contradicting["facts"])
        result = admissions_assessment.assess_resolved_context(contradicting, {})
        self.assertIsNone(result["overallChance"])
        self.assertEqual("mismatched", result["applicability"]["applicant"])

    def test_routes_without_an_implied_category_keep_the_requested_one(self):
        coterm = "directory-evidence:stanford-coterm-cs-ms"
        resolved = admissions_catalog.resolve_context(STANFORD, context={
            "study_option_id": "stanford-option-cs-ms", "application_route_id": coterm, "study_level": "masters",
            "applicant_route": "graduate"})
        self.assertEqual("graduate", resolved["context"]["applicant_route"])
        self.assertNotIn("applicant", resolved["context_applicability"])

    def test_shared_institution_route_without_an_option_implies_its_category(self):
        resolved = admissions_catalog.resolve_context(MIT, context={"application_route_id": "mit-transfer"})
        self.assertEqual("transfer", resolved["context"]["applicant_route"])
        contradicting = admissions_catalog.resolve_context(MIT, context={"application_route_id": "mit-transfer", "applicant_route": "first_year"})
        self.assertEqual("mismatched", contradicting["context_applicability"]["applicant"])


if __name__ == "__main__":
    unittest.main()

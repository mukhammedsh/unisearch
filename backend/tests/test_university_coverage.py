import copy
import unittest

from fastapi.testclient import TestClient

from app.main import app
from app.services import admissions_catalog
from app.services.university_coverage import build_coverage_by_level, build_coverage_by_program
from app.services.universities import get_university_by_id


class UniversityCoverageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def resolve(self, institution_id, option_id, route_id, level):
        return admissions_catalog.resolve_context(institution_id, context={
            "study_option_id": option_id,
            "application_route_id": route_id,
            "study_level": level,
        })

    def fact(self, result, fact_id):
        rows = result["facts"] + result["unknowns"] + result["history"]["facts"] + result["history"]["unknowns"]
        return next(row for row in rows if row["id"] == fact_id)

    def source_urls(self, result, fact):
        return {row["id"]: row["url"] for row in result["sources"] if row["id"] in fact["source_ids"]}

    def test_mit_graduate_routes_keep_awards_and_eligibility_scoped(self):
        result = self.resolve("mit-usa-cambridge", "mit-linguistics-sm-mit-grad-linguistics", "mit_mitili_sm_admissions", "masters")
        funding = self.fact(result, "mit_mitili_sm_admissions-funding-0-0")
        tests = self.fact(result, "mitili-academic-tests-unestablished")
        self.assertEqual(result["selected_route"]["id"], "mit_mitili_sm_admissions")
        self.assertEqual(result["selected_option"]["id"], "mit-linguistics-sm-mit-grad-linguistics")
        self.assertEqual(funding["topic"], "funding")
        self.assertEqual(funding["scope"]["route_ids"], ["mit_mitili_sm_admissions"])
        self.assertEqual(tests["publication_status"], "unknown")
        self.assertIn("https://linguistics.mit.edu/mitili/", self.source_urls(result, funding).values())
        self.assertIn("https://linguistics.mit.edu/mitili/", self.source_urls(result, tests).values())

    def test_reviewed_detail_api_reports_admissions_catalog_metadata(self):
        response = self.client.get("/universities/mit-usa-cambridge")
        self.assertEqual(response.status_code, 200)
        contract = response.json()["admissions_catalog"]
        self.assertEqual(contract["availability"], "reviewed")
        self.assertEqual(contract["study_option_count"], len(admissions_catalog.get_institution("mit-usa-cambridge")["study_options"]))
        self.assertIn("undergraduate", contract["study_levels"])
        self.assertIn("doctoral", contract["study_levels"])
        self.assertNotIn("coverage_by_level", response.json())
        self.assertNotIn("coverage_by_program", response.json())

    def test_imperial_computing_course_facts_stay_with_selected_options(self):
        undergraduate = self.resolve("imperial-college-london-uk", "imperial-option-computing-meng", "procedure-computing-meng", "undergraduate")
        masters = self.resolve("imperial-college-london-uk", "imperial-option-computing", "procedure-computing", "masters")
        ug_profile = self.fact(undergraduate, "imperial-computing-meng-course-profile")
        masters_profile = self.fact(masters, "imperial-computing-course-profile")
        self.assertEqual(ug_profile["scope"]["option_ids"], ["imperial-option-computing-meng"])
        self.assertEqual(masters_profile["scope"]["option_ids"], ["imperial-option-computing"])
        self.assertEqual(ug_profile["scope"]["cycle"], "2027 entry")
        self.assertEqual(masters_profile["scope"]["cycle"], "2027 entry")
        self.assertEqual(ug_profile["value"]["course_page_tuition_fees"]["Home fee"][0]["amounts_and_periods"], ["£10,050 per year"])
        self.assertEqual(masters_profile["value"]["course_page_tuition_fees"]["Overseas fee"][0]["amounts_and_periods"], ["£48,300"])
        self.assertIn("https://www.imperial.ac.uk/study/courses/undergraduate/2027/computing-meng/", self.source_urls(undergraduate, ug_profile).values())
        self.assertIn("https://www.imperial.ac.uk/study/courses/postgraduate-taught/2027/computing/", self.source_urls(masters, masters_profile).values())
        self.assertFalse(any(row["id"] == "imperial-computing-meng-course-profile" for row in masters["facts"]))
        self.assertFalse(any(row["id"] == "imperial-computing-course-profile" for row in undergraduate["facts"]))

    def test_paused_harvard_oxford_and_cambridge_catalogs_remain_legacy_unreviewed(self):
        for university_id in ("harvard-usa-cambridge", "university-of-oxford-uk-oxford", "university-of-cambridge-uk-cambridge"):
            with self.subTest(university_id=university_id):
                contract = admissions_catalog.get_public_contract(university_id)
                self.assertEqual(contract["availability"], "legacy_unreviewed")
                self.assertIsNone(contract["study_option_count"])
                self.assertEqual(contract["study_levels"], [])
                with self.assertRaises(admissions_catalog.InstitutionNotFoundError):
                    admissions_catalog.resolve_context(university_id)

    def test_mixed_msc_and_mba_category_covers_both_master_tracks(self):
        coverage = build_coverage_by_level(
            {
                "admission_categories": [
                    {
                        "id": "business_msc_mba",
                        "study_levels": ["Master"],
                        "deadlines": [{"deadline": "October 1"}],
                    }
                ]
            }
        )
        self.assertEqual(set(coverage), {"master", "mba"})
        self.assertEqual(coverage["master"]["deadlines"]["approximate_or_yearless"], "available")
        self.assertEqual(coverage["mba"]["deadlines"]["approximate_or_yearless"], "available")

    def test_generic_graduate_deadline_does_not_count_as_mba_deadline(self):
        coverage = build_coverage_by_level(
            {
                "academics": {
                    "programs": [
                        {"name": "MSc in Data Science", "study_levels": ["Master"]},
                        {"name": "Full-Time MBA", "study_levels": ["Master"]},
                    ]
                },
                "deadlines": {
                    "graduate_taught_masters": {
                        "application_deadline": "2026-09-01",
                    }
                },
            }
        )
        self.assertEqual(coverage["master"]["deadlines"]["exact_dated"], "available")
        self.assertEqual(coverage["mba"]["deadlines"]["exact_dated"], "not_catalogued")

    def test_paid_only_route_is_not_counted_as_aid_or_funding_coverage(self):
        coverage = build_coverage_by_level(
            {
                "academics": {"programs": [{"name": "Bachelor Program", "study_levels": ["Bachelor"]}]},
                "admission_categories": [
                    {
                        "id": "bachelor_paid",
                        "study_levels": ["Bachelor"],
                        "funding_options": [{"id": "paid", "funding_type": "paid"}],
                    }
                ],
            }
        )
        self.assertEqual(coverage["bachelor"]["aid_funding"], "not_catalogued")

    def test_program_deadline_and_prior_year_tuition_keep_distinct_sources_and_cycles(self):
        coverage = build_coverage_by_program({
            "academics": {"programs": [{
                "name": "MBA",
                "study_levels": ["Master"],
                "application_deadline": "2027-01-06",
                "source_url": "https://example.edu/admissions",
                "cycle": "Fall 2027 entry",
                "tuition_year_usd": 89000,
                "tuition_source_url": "https://example.edu/2026-27-fees",
                "tuition_cycle": "2026-27 published fees; 2027-28 not confirmed",
            }]}
        })[0]
        self.assertEqual(coverage["deadline"]["cycle"], "Fall 2027 entry")
        self.assertEqual(coverage["deadline"]["source_url"], "https://example.edu/admissions")
        self.assertEqual(coverage["tuition_mandatory_fees"]["cycle"], "2026-27 published fees; 2027-28 not confirmed")
        self.assertEqual(coverage["tuition_mandatory_fees"]["source_url"], "https://example.edu/2026-27-fees")

    def test_legacy_bachelor_only_row_does_not_gain_graduate_coverage(self):
        coverage = get_university_by_id("eth-zurich-ch-zurich", localized=True)["coverage_by_level"]
        self.assertEqual(set(coverage), {"bachelor"})
        self.assertEqual(coverage["bachelor"]["costs"]["undergraduate_root_finance"], "available")

    def test_unscoped_legacy_categories_do_not_create_levels(self):
        coverage = build_coverage_by_level(
            {
                "academics": {"study_levels": ["Bachelor", "Master"], "programs": []},
                "admission_categories": [
                    {
                        "id": "general",
                        "scope": "general",
                        "requirement_profiles": [{"requirements": {"SAT": 1400}}],
                    }
                ],
            }
        )
        self.assertEqual(coverage, {})

    def test_mit_bachelor_routes_target_the_institution_and_share_only_explicit_budget_guidance(self):
        first_year = self.resolve("mit-usa-cambridge", "mit-course-6-3-bachelor", "mit-first-year", "undergraduate")
        transfer = self.resolve("mit-usa-cambridge", "mit-course-6-3-bachelor", "mit-transfer", "undergraduate")
        first_route, transfer_route = first_year["selected_route"], transfer["selected_route"]
        self.assertEqual(first_route["target"], "MIT undergraduate admission")
        self.assertEqual(transfer_route["target"], "MIT undergraduate transfer admission")
        self.assertIn("mit-course-6-3-bachelor", first_route["option_ids"])
        self.assertIn("mit-course-6-3-bachelor", transfer_route["option_ids"])
        first_deadline = self.fact(first_year, "mit-first-year-application-deadline")
        transfer_deadline = self.fact(transfer, "mit-transfer-application-deadline")
        self.assertEqual(first_deadline["scope"]["route_ids"], ["mit-first-year"])
        self.assertEqual(transfer_deadline["scope"]["route_ids"], ["mit-transfer"])
        self.assertIn("January 4", first_deadline["value"])
        self.assertIn("March 1, 2027", transfer_deadline["value"])
        self.assertIn("October 15, 2026", transfer_deadline["value"])
        self.assertIn("https://mitadmissions.org/apply/firstyear/deadlines-requirements/", self.source_urls(first_year, first_deadline).values())
        self.assertIn("https://mitadmissions.org/apply/transfer/deadlines/", self.source_urls(transfer, transfer_deadline).values())
        budget = self.fact(first_year, "undergraduate-budget-2026-27")
        self.assertEqual(budget["scope"]["route_ids"], ["mit-first-year", "mit-transfer"])
        self.assertEqual(budget["scope"]["option_ids"], [])
        self.assertEqual(budget["value"]["tuition"], 66720)
        self.assertIn("https://sfs.mit.edu/cost-of-attendance-class-of-2030/", self.source_urls(first_year, budget).values())
        self.assertEqual(admissions_catalog.resolve_context("mit-usa-cambridge")["facts"], [])

    def test_oxford_draft_data_is_not_exposed_as_reviewed_admissions(self):
        contract = admissions_catalog.get_public_contract("university-of-oxford-uk-oxford")
        self.assertEqual(contract["availability"], "legacy_unreviewed")
        self.assertIsNone(contract["revision"])
        with self.assertRaises(admissions_catalog.InstitutionNotFoundError):
            admissions_catalog.resolve_context("university-of-oxford-uk-oxford", context={
                "study_option_id": "msc_advanced_computer_science_pgt",
                "application_route_id": "graduate_taught",
                "study_level": "masters",
            })

    def test_imperial_computing_phd_does_not_inherit_taught_course_rounds(self):
        phd = self.resolve("imperial-college-london-uk", "imperial-computing-phd", "procedure-computing-phd", "doctoral")
        phd_admission = self.fact(phd, "imperial-computing-phd-admission")
        taught = self.resolve("imperial-college-london-uk", "imperial-option-computing", "procedure-computing", "masters")
        taught_application = self.fact(taught, "imperial-computing-application-details")
        self.assertEqual(phd_admission["scope"]["option_ids"], ["imperial-computing-phd"])
        self.assertEqual(phd_admission["scope"]["route_ids"], [])
        self.assertIn("https://www.imperial.ac.uk/engineering/departments/computing/prospective-students/phd/", self.source_urls(phd, phd_admission).values())
        self.assertEqual(taught_application["scope"]["option_ids"], ["imperial-option-computing"])
        self.assertIn("rounds", str(taught_application["value"]).lower())
        self.assertFalse(any(row["id"] == taught_application["id"] for row in phd["facts"]))
        self.assertFalse(any("deadline" in row["topic"] for row in phd["facts"]))

    def test_imperial_course_limited_awards_do_not_attach_to_every_degree_at_the_same_level(self):
        institution = admissions_catalog.get_institution("imperial-college-london-uk")
        scholarship = next(row for row in institution["facts"] if row["id"] == "fact_imperial_inspires_2027_scoped")
        option_ids = set(scholarship["scope"]["option_ids"])
        self.assertIn("imperial-option-finance", option_ids)
        self.assertNotIn("imperial-option-computing", option_ids)
        self.assertNotIn("imperial-computing-phd", option_ids)
        source_urls = {row["id"]: row["url"] for row in institution["sources"]}
        self.assertIn("https://www.imperial.ac.uk/study/fees-and-funding/imperial-inspires-scholarships/terms-and-conditions/", [source_urls[x] for x in scholarship["source_ids"]])
        finance = self.resolve("imperial-college-london-uk", "imperial-option-finance", "procedure-finance", "masters")
        computing = self.resolve("imperial-college-london-uk", "imperial-option-computing", "procedure-computing", "masters")
        self.assertIn(scholarship["id"], {row["id"] for row in finance["facts"]})
        self.assertNotIn(scholarship["id"], {row["id"] for row in computing["facts"]})

    def test_harvard_draft_data_is_not_exposed_as_reviewed_admissions(self):
        contract = admissions_catalog.get_public_contract("harvard-usa-cambridge")
        self.assertEqual(contract["availability"], "legacy_unreviewed")
        self.assertIsNone(contract["revision"])
        with self.assertRaises(admissions_catalog.InstitutionNotFoundError):
            admissions_catalog.resolve_context("harvard-usa-cambridge")

    def test_mit_sloan_rounds_are_route_scoped_and_hbs_remains_unreviewed(self):
        mba = self.resolve("mit-usa-cambridge", "mit-sloan-mba-full-time", "mit_sloan_mba_admissions", "masters")
        deadlines = self.fact(mba, "mit_sloan_mba_admissions-deadlines")
        rounds = {row["deadline_type"]: row for row in deadlines["value"]}
        self.assertEqual(set(rounds), {"round_1", "round_2"})
        self.assertEqual((rounds["round_1"]["date"], rounds["round_1"]["time"], rounds["round_1"]["timezone"]),
                         ("2026-09-29", "15:00", "America/New_York"))
        self.assertEqual((rounds["round_2"]["date"], rounds["round_2"]["time"], rounds["round_2"]["timezone"]),
                         ("2027-01-12", "15:00", "America/New_York"))
        self.assertEqual(deadlines["scope"]["route_ids"], ["mit_sloan_mba_admissions"])
        self.assertIn("https://mitsloan.mit.edu/mba/admissions/how-to-apply", self.source_urls(mba, deadlines).values())
        self.assertEqual(admissions_catalog.get_public_contract("harvard-usa-cambridge")["availability"], "legacy_unreviewed")

    def test_oxford_program_fees_remain_outside_reviewed_runtime(self):
        contract = admissions_catalog.get_public_contract("university-of-oxford-uk-oxford")
        self.assertEqual(contract["availability"], "legacy_unreviewed")
        self.assertIsNone(contract["study_option_count"])
        self.assertEqual(contract["study_levels"], [])

    def test_mit_eecs_phd_funding_does_not_attach_to_other_doctorates(self):
        eecs = self.resolve("mit-usa-cambridge", "mit-eecs-phd-course-6", "mit_eecs_doctoral_admissions", "doctoral")
        transportation = self.resolve("mit-usa-cambridge", "mit-transportation-phd", "mit_transportation_doctoral_admissions", "doctoral")
        funding = self.fact(eecs, "reviewed-mit_eecs_doctoral_admissions-funding")
        funding_unknown = self.fact(transportation, "transportation-doctoral-funding-unestablished")
        self.assertEqual(funding["scope"]["option_ids"], ["mit-eecs-phd-course-6", "mit-eecs-scd"])
        self.assertEqual(funding["scope"]["route_ids"], ["mit_eecs_doctoral_admissions"])
        self.assertIn("https://www.eecs.mit.edu/academics/graduate-programs/admission-process/", self.source_urls(eecs, funding).values())
        self.assertEqual(funding_unknown["publication_status"], "unknown")
        self.assertNotIn("reviewed-mit_eecs_doctoral_admissions-funding", {row["id"] for row in transportation["facts"]})
        self.assertIn("https://catalog.mit.edu/interdisciplinary/graduate-programs/transportation/", self.source_urls(transportation, funding_unknown).values())

    def test_mit_msms_keeps_current_cost_unknown_and_older_fee_as_reference(self):
        msms = self.resolve("mit-usa-cambridge", "mit-sloan-msms", "mit_sloan_msms_admissions", "masters")
        current = self.fact(msms, "mit-sloan-msms-price-1")
        prior = self.fact(msms, "mit-sloan-msms-price-0")
        self.assertEqual(current["publication_status"], "not_published")
        self.assertEqual(current["value"]["publication_status"], "unknown")
        self.assertIsNone(current["value"]["amount"])
        self.assertEqual(prior["publication_status"], "published")
        self.assertEqual(prior["review_status"], "superseded")
        self.assertEqual(prior["value"]["amount"], 91892)
        self.assertIn("2026-27", str(prior["value"]))
        self.assertIn(prior["id"], msms["history"]["fact_ids"])
        self.assertIn("https://mitsloan.mit.edu/msms/how-to-finance-your-mit-sloan-master-science-management-studies", self.source_urls(msms, current).values())
        self.assertIn("https://mitsloan.mit.edu/msms/how-to-finance-your-mit-sloan-master-science-management-studies", self.source_urls(msms, prior).values())

    def test_stanford_mba_aid_is_option_scoped_and_oxford_remains_unreviewed(self):
        mba = self.resolve("stanford-university-usa-ca", "stanford-option-gsb-mba", "professional-evidence:gsb_mba_admission", "professional")
        jd = self.resolve("stanford-university-usa-ca", "stanford-option-law-jd", "professional-evidence:law_jd_admission", "professional")
        aid = self.fact(mba, "professional-evidence:gsb_mba_aid_process")
        self.assertEqual(aid["scope"]["option_ids"], ["stanford-option-gsb-mba"])
        self.assertEqual(aid["scope"]["route_ids"], ["professional-evidence:gsb_mba_admission"])
        self.assertIn("https://www.gsb.stanford.edu/programs/mba/tuition-financial-aid/application-process", self.source_urls(mba, aid).values())
        self.assertNotIn(aid["id"], {row["id"] for row in jd["facts"]})
        oxford = admissions_catalog.get_public_contract("university-of-oxford-uk-oxford")
        self.assertEqual(oxford["availability"], "legacy_unreviewed")

    def test_scoped_route_deadlines_only_reach_the_named_program_and_keep_unpublished_status(self):
        university = {
            "academics": {"programs": [
                {"id": "stanford-cs-phd", "name": "Computer Science PhD", "study_levels": ["Doctorate"]},
                {"id": "stanford-business-phd", "name": "PhD in Business", "study_levels": ["Doctorate"],
                 "application_deadline": "Not yet published for Fall 2027 entry; check Stanford GSB official deadline page."},
            ]},
            "admission_categories": [{
                "id": "stanford-doctoral-route",
                "scope": "postgraduate_research",
                "program_ids": ["stanford-cs-phd", "stanford-business-phd"],
                "study_levels": ["Doctorate"],
                "deadlines": [
                    {
                        "round": "Unscoped legacy PhD date",
                        "application_deadline": "December 1, 2026",
                    },
                    {
                        "round": "General PhD guidance",
                        "application_deadline": "Set by the intended graduate program; check its official program page.",
                        "notes": "Dates differ across departments.",
                    },
                    {
                        "id": "cs-phd-2027-deadline", "deadline_type": "application",
                        "publication_status": "published", "applicability": "program_specific",
                        "program_ids": ["stanford-cs-phd"], "study_levels": ["Doctorate"],
                        "date": "2026-12-02", "time": "23:59", "timezone": "America/Los_Angeles",
                        "cycle": "2027 entry", "source_url": "https://www.stanford.edu/admissions/cs",
                        "verified_at": "2026-09-24",
                    },
                    {
                        "id": "business-phd-2027-deadline", "deadline_type": "application",
                        "publication_status": "not_yet_published", "applicability": "program_specific",
                        "program_ids": ["stanford-business-phd"], "study_levels": ["Doctorate"],
                        "application_deadline": "Not yet published for Fall 2027 entry",
                        "cycle": "Fall 2027 entry", "source_url": "https://www.gsb.stanford.edu/programs/phd/admission/deadline-decisions",
                        "verified_at": "2026-09-24",
                    },
                ],
            }],
        }
        coverage = {row["program_id"]: row for row in build_coverage_by_program(university)}
        cs_deadline = coverage["stanford-cs-phd"]["deadline"]
        business_deadline = coverage["stanford-business-phd"]["deadline"]
        self.assertEqual(cs_deadline["scope"], "program_specific")
        self.assertEqual([row["id"] for row in cs_deadline["values"]], ["cs-phd-2027-deadline"])
        self.assertEqual(business_deadline["status"], "not_catalogued")
        self.assertEqual(business_deadline["publication_status"], "not_yet_published")
        self.assertEqual(business_deadline["cycle"], "Fall 2027 entry")
        self.assertEqual(business_deadline["values"], [])
        self.assertEqual(business_deadline["publication_facts"][0]["id"], "business-phd-2027-deadline")
        self.assertEqual(business_deadline["source_url"], "https://www.gsb.stanford.edu/programs/phd/admission/deadline-decisions")
        self.assertNotEqual(business_deadline["status"], "approximate_or_yearless")

        without_scoped_business_row = copy.deepcopy(university)
        route = without_scoped_business_row["admission_categories"][0]
        route["deadlines"] = [row for row in route["deadlines"] if row.get("id") != "business-phd-2027-deadline"]
        fallback_coverage = {
            row["program_id"]: row for row in build_coverage_by_program(without_scoped_business_row)
        }
        fallback = fallback_coverage["stanford-business-phd"]["deadline"]
        self.assertEqual(fallback["status"], "not_catalogued")
        self.assertEqual(fallback["publication_status"], "not_yet_published")
        self.assertEqual(fallback["values"], [])

    def test_structured_price_facts_drive_program_coverage(self):
        university = {
            "academics": {"programs": [{
                "id": "stanford-ms-cs", "name": "MS Computer Science", "study_levels": ["Master"],
                "tuition_year_usd": 65000,
                "price_facts": [{
                    "id": "stanford-ms-cs-tuition-2026", "kind": "tuition", "amount": 65000,
                    "currency": "USD", "period": "academic_year", "fee_status": "home",
                    "applicability": "program_specific", "study_levels": ["Master"],
                    "publication_status": "published", "cycle": "2026-27",
                    "source_url": "https://www.stanford.edu/tuition", "verified_at": "2026-09-24",
                    "legacy_field": "tuition_year_usd",
                }],
            }]},
        }
        fact = build_coverage_by_program(university)[0]["tuition_mandatory_fees"]
        self.assertEqual(fact["status"], "available")
        price_label = next(iter(fact["values"]))
        self.assertIn("tuition_home_academic_year_usd", price_label)
        self.assertEqual(fact["values"][price_label], 65000)
        self.assertEqual(fact["price_facts"][0]["fee_status"], "home")

    def test_price_values_keep_distinct_quantity_basis_rows(self):
        university = {
            "academics": {"programs": [{
                "id": "stanford-ms-test", "name": "MS Test", "study_levels": ["Master"],
                "price_facts": [
                    {"id": "tuition-8-10-units", "kind": "tuition", "amount": 18000,
                     "currency": "USD", "period": "academic_quarter", "fee_status": "all_students",
                     "quantity_basis": "8-10 units", "publication_status": "published",
                     "cycle": "2026-27", "applicability": "program_specific"},
                    {"id": "tuition-11-18-units", "kind": "tuition", "amount": 24000,
                     "currency": "USD", "period": "academic_quarter", "fee_status": "all_students",
                     "quantity_basis": "11-18 units", "publication_status": "published",
                     "cycle": "2026-27", "applicability": "program_specific"},
                ],
            }]},
        }
        fact = build_coverage_by_program(university)[0]["tuition_mandatory_fees"]
        self.assertEqual(fact["values"], {
            "tuition_all_students_academic_quarter_8_10_units_usd": 18000,
            "tuition_all_students_academic_quarter_11_18_units_usd": 24000,
        })
        self.assertEqual(len(fact["price_facts"]), 2)

    def test_future_unpublished_price_does_not_relabel_a_legacy_historical_fee(self):
        university = {
            "academics": {"programs": [{
                "id": "imperial-msc-test", "name": "MSc Test", "study_levels": ["Master"],
                "overseas_annual_fee_gbp": 32000, "currency": "GBP",
                "tuition_cycle": "2026-27 entry",
                "tuition_source_url": "https://www.imperial.ac.uk/study/fees-and-funding/tuition-fees/",
                "price_facts": [{
                    "id": "imperial-msc-test-overseas-2027-28", "kind": "tuition",
                    "amount": None, "currency": "GBP", "period": "academic_year",
                    "fee_status": "overseas", "applicability": "program_specific",
                    "program_ids": ["imperial-msc-test"], "study_levels": ["Master"],
                    "publication_status": "not_yet_published", "cycle": "2027-28 entry",
                    "source_url": "https://www.imperial.ac.uk/study/fees-and-funding/tuition-fees/",
                    "verified_at": "2026-09-24",
                }],
            }]},
        }
        fact = build_coverage_by_program(university)[0]["tuition_mandatory_fees"]
        self.assertEqual(fact["status"], "not_catalogued")
        self.assertEqual(fact["publication_status"], "not_yet_published")
        self.assertEqual(fact["cycle"], "2027-28 entry")
        self.assertEqual(fact["source_url"], "https://www.imperial.ac.uk/study/fees-and-funding/tuition-fees/")
        self.assertEqual(fact["values"], {})
        self.assertNotIn("amount", fact["publication_facts"][0])
        self.assertEqual(fact["historical_legacy_values"]["values"]["overseas_annual_fee_gbp"], 32000)
        self.assertEqual(fact["historical_legacy_values"]["cycle"], "2026-27 entry")
        self.assertEqual(fact["historical_legacy_values"]["source_url"], "https://www.imperial.ac.uk/study/fees-and-funding/tuition-fees/")
        self.assertNotIn("period", fact["historical_legacy_values"])

    def test_unknown_home_price_does_not_hide_published_overseas_price(self):
        university = {
            "academics": {"programs": [{
                "id": "imperial-msc-test", "name": "MSc Test", "study_levels": ["Master"],
                "price_facts": [
                    {"id": "overseas-published", "kind": "tuition", "amount": 40000,
                     "currency": "GBP", "period": "academic_year", "fee_status": "overseas",
                     "publication_status": "published", "cycle": "2027-28 entry",
                     "applicability": "program_specific", "source_url": "https://example.edu/fees"},
                    {"id": "home-unpublished", "kind": "tuition", "amount": None,
                     "currency": "GBP", "period": "academic_year", "fee_status": "home",
                     "publication_status": "not_yet_published", "cycle": "2027-28 entry",
                     "applicability": "program_specific", "source_url": "https://example.edu/fees"},
                ],
            }]},
        }
        fact = build_coverage_by_program(university)[0]["tuition_mandatory_fees"]
        self.assertEqual(fact["status"], "available")
        self.assertEqual(fact["values"], {"tuition_overseas_academic_year_gbp": 40000})
        self.assertEqual([item["id"] for item in fact["price_facts"]], ["overseas-published"])
        self.assertEqual([item["id"] for item in fact["publication_facts"]], ["home-unpublished"])
        self.assertEqual(fact["publication_status"], "not_yet_published")

    def test_future_unknown_price_keeps_older_structured_price_historical(self):
        university = {
            "academics": {"programs": [{
                "id": "imperial-msc-test", "name": "MSc Test", "study_levels": ["Master"],
                "price_facts": [
                    {"id": "overseas-2026", "kind": "tuition", "amount": 39000,
                     "currency": "GBP", "period": "academic_year", "fee_status": "overseas",
                     "publication_status": "published", "cycle": "2026-27 entry",
                     "applicability": "program_specific", "source_url": "https://example.edu/fees/2026"},
                    {"id": "overseas-2027", "kind": "tuition", "amount": None,
                     "currency": "GBP", "period": "academic_year", "fee_status": "overseas",
                     "publication_status": "not_yet_published", "cycle": "2027-28 entry",
                     "applicability": "program_specific", "source_url": "https://example.edu/fees/2027"},
                ],
            }]},
        }
        fact = build_coverage_by_program(university)[0]["tuition_mandatory_fees"]
        self.assertEqual(fact["status"], "not_catalogued")
        self.assertEqual(fact["cycle"], "2027-28 entry")
        self.assertEqual(fact["source_url"], "https://example.edu/fees/2027")
        self.assertEqual(fact["values"], {})
        self.assertNotIn("price_facts", fact)
        self.assertEqual([row["id"] for row in fact["historical_price_facts"]], ["overseas-2026"])
        self.assertEqual(fact["publication_facts"][0]["cycle"], "2027-28 entry")

    def test_legacy_term_price_history_keeps_original_field_without_guessing_period(self):
        university = {
            "academics": {"programs": [{
                "id": "imperial-msc-test", "name": "MSc Test", "study_levels": ["Master"],
                "tuition_per_quarter_usd": 12000, "tuition_cycle": "2026-27 entry",
                "tuition_source_url": "https://example.edu/fees/2026",
                "price_facts": [{
                    "id": "future-unknown", "kind": "tuition", "amount": None,
                    "currency": "USD", "period": "academic_year", "fee_status": "overseas",
                    "publication_status": "not_yet_published", "cycle": "2027-28 entry",
                    "applicability": "program_specific", "source_url": "https://example.edu/fees/2027",
                }],
            }]},
        }
        fact = build_coverage_by_program(university)[0]["tuition_mandatory_fees"]
        historical = fact["historical_legacy_values"]
        self.assertEqual(historical["values"], {"tuition_per_quarter_usd": 12000})
        self.assertEqual(historical["cycle"], "2026-27 entry")
        self.assertEqual(historical["source_url"], "https://example.edu/fees/2026")
        self.assertNotIn("period", historical)
        self.assertNotIn("price_facts", fact)

    def test_conflicting_price_suppresses_only_same_fee_status(self):
        university = {
            "academics": {"programs": [{
                "id": "imperial-msc-test", "name": "MSc Test", "study_levels": ["Master"],
                "price_facts": [
                    {"id": "overseas-known", "kind": "tuition", "amount": 40000,
                     "currency": "GBP", "period": "academic_year", "fee_status": "overseas",
                     "publication_status": "published", "cycle": "2027-28 entry",
                     "applicability": "program_specific", "source_url": "https://example.edu/fees"},
                    {"id": "overseas-conflicting", "kind": "tuition", "amount": None,
                     "currency": "GBP", "period": "academic_year", "fee_status": "overseas",
                     "publication_status": "conflicting", "cycle": "2027-28 entry",
                     "applicability": "program_specific", "source_url": "https://example.edu/fees"},
                    {"id": "home-known", "kind": "tuition", "amount": 15000,
                     "currency": "GBP", "period": "academic_year", "fee_status": "home",
                     "publication_status": "published", "cycle": "2027-28 entry",
                     "applicability": "program_specific", "source_url": "https://example.edu/fees"},
                ],
            }]},
        }
        fact = build_coverage_by_program(university)[0]["tuition_mandatory_fees"]
        self.assertEqual(fact["status"], "available")
        self.assertEqual(fact["values"], {"tuition_home_academic_year_gbp": 15000})
        self.assertEqual([item["id"] for item in fact["price_facts"]], ["home-known"])
        self.assertEqual([item["id"] for item in fact["publication_facts"]], ["overseas-conflicting"])
        self.assertEqual(fact["publication_status"], "conflicting")

    def test_oxford_route_deadlines_are_filtered_to_each_program(self):
        university = {
            "academics": {"programs": [
                {"id": "oxford-msc-a", "name": "MSc A", "study_levels": ["Master"]},
                {"id": "oxford-msc-b", "name": "MSc B", "study_levels": ["Master"]},
            ]},
            "admission_categories": [{
                "id": "oxford-postgraduate-route", "scope": "postgraduate_taught",
                "program_ids": ["oxford-msc-a", "oxford-msc-b"], "study_levels": ["Master"],
                "deadlines": [
                    {"id": "oxford-a-deadline", "deadline_type": "course_application",
                     "publication_status": "published", "applicability": "program_specific",
                     "program_ids": ["oxford-msc-a"], "study_levels": ["Master"],
                     "date": "2027-01-06", "time": "12:00", "timezone": "Europe/London",
                     "cycle": "2027-28 entry", "source_url": "https://www.ox.ac.uk/course/a",
                     "verified_at": "2026-09-24"},
                    {"id": "oxford-b-deadline", "deadline_type": "course_application",
                     "publication_status": "published", "applicability": "program_specific",
                     "program_ids": ["oxford-msc-b"], "study_levels": ["Master"],
                     "date": "2027-03-01", "time": "12:00", "timezone": "Europe/London",
                     "cycle": "2027-28 entry", "source_url": "https://www.ox.ac.uk/course/b",
                     "verified_at": "2026-09-24"},
                ],
            }],
        }
        coverage = {row["program_id"]: row for row in build_coverage_by_program(university)}
        self.assertEqual([row["id"] for row in coverage["oxford-msc-a"]["deadline"]["values"]], ["oxford-a-deadline"])
        self.assertEqual([row["id"] for row in coverage["oxford-msc-b"]["deadline"]["values"]], ["oxford-b-deadline"])

    def test_mit_conflicting_program_deadline_suppresses_legacy_text_and_other_program_dates(self):
        university = {
            "academics": {"programs": [
                {"id": "mit-eecs-phd-course-6", "name": "PhD in EECS", "study_levels": ["Doctorate"],
                 "application_deadline": "Deadline listings conflict on the exact date; check the live application."},
                {"id": "mit-meche-phd-course-2", "name": "PhD in Mechanical Engineering", "study_levels": ["Doctorate"]},
            ]},
            "admission_categories": [{
                "id": "mit-phd-route", "scope": "doctoral_research",
                "program_ids": ["mit-eecs-phd-course-6", "mit-meche-phd-course-2"],
                "study_levels": ["Doctorate"],
                "deadlines": [
                    {"id": "mit-eecs-conflicting-deadline", "deadline_type": "course_application",
                     "publication_status": "conflicting", "applicability": "program_specific",
                     "program_ids": ["mit-eecs-phd-course-6"], "study_levels": ["Doctorate"],
                     "cycle": "Fall 2027 entry", "source_url": "https://www.eecs.mit.edu/academics/graduate-programs/admission-process/",
                     "verified_at": "2026-09-24", "note": "Department and central entry-cycle wording conflict."},
                    {"id": "mit-meche-published-deadline", "deadline_type": "course_application",
                     "publication_status": "published", "applicability": "program_specific",
                     "program_ids": ["mit-meche-phd-course-2"], "study_levels": ["Doctorate"],
                     "date": "2026-12-01", "time": "23:59", "timezone": "America/New_York",
                     "cycle": "Fall 2027 entry", "source_url": "https://oge.mit.edu/programs/mechanical-engineering/",
                     "verified_at": "2026-09-24"},
                ],
            }],
        }
        coverage = {row["program_id"]: row for row in build_coverage_by_program(university)}
        eecs_deadline = coverage["mit-eecs-phd-course-6"]["deadline"]
        meche_deadline = coverage["mit-meche-phd-course-2"]["deadline"]
        self.assertEqual(eecs_deadline["status"], "not_catalogued")
        self.assertEqual(eecs_deadline["publication_status"], "conflicting")
        self.assertEqual(eecs_deadline["source_url"], "https://www.eecs.mit.edu/academics/graduate-programs/admission-process/")
        self.assertEqual(eecs_deadline["values"], [])
        self.assertEqual([row["id"] for row in eecs_deadline["publication_facts"]], ["mit-eecs-conflicting-deadline"])
        self.assertEqual(meche_deadline["status"], "exact_dated")
        self.assertEqual([row["id"] for row in meche_deadline["values"]], ["mit-meche-published-deadline"])


if __name__ == "__main__":
    unittest.main()

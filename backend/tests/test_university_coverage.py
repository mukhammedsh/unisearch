import copy
import unittest

from fastapi.testclient import TestClient

from app.main import app
from app.services.university_coverage import build_coverage_by_level, build_coverage_by_program
from app.services.universities import get_university_by_id


class UniversityCoverageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_pilot_detail_api_reports_level_scoped_coverage(self):
        response = self.client.get("/universities/mit-usa-cambridge")
        self.assertEqual(response.status_code, 200)
        coverage = response.json().get("coverage_by_level")
        program_coverage = response.json().get("coverage_by_program")
        self.assertEqual(set(coverage), {"bachelor", "master", "doctorate", "mba"})
        self.assertTrue(program_coverage)

        self.assertEqual(coverage["bachelor"]["programs"], "available")
        self.assertEqual(
            coverage["bachelor"]["deadlines"],
            {"exact_dated": "available", "approximate_or_yearless": "available"},
        )
        self.assertEqual(coverage["bachelor"]["costs"]["undergraduate_root_finance"], "available")

        self.assertEqual(coverage["master"]["costs"]["program_specific"], "available")
        self.assertEqual(coverage["master"]["costs"]["undergraduate_root_finance"], "not_catalogued")
        self.assertEqual(coverage["mba"]["deadlines"]["exact_dated"], "available")
        self.assertEqual(coverage["mba"]["aid_funding"], "available")

    def test_top_five_exact_dates_and_program_costs_are_level_scoped(self):
        coverage = get_university_by_id("imperial-college-london-uk", localized=True)["coverage_by_level"]
        self.assertEqual(coverage["bachelor"]["deadlines"]["exact_dated"], "available")
        self.assertEqual(coverage["master"]["deadlines"]["exact_dated"], "available")
        # Computing PhD publishes four 2027 department review cutoffs.
        self.assertEqual(coverage["doctorate"]["deadlines"]["exact_dated"], "available")
        self.assertEqual(coverage["mba"]["costs"]["program_specific"], "not_catalogued")
        self.assertEqual(coverage["mba"]["costs"]["undergraduate_root_finance"], "not_catalogued")

        program_coverage = get_university_by_id("imperial-college-london-uk", localized=True)["coverage_by_program"]
        computing = next(row for row in program_coverage if row["program_name"] == "Computing (BEng)")
        self.assertEqual(computing["tuition_mandatory_fees"]["scope"], "university_guidance")
        self.assertEqual(computing["tuition_mandatory_fees"]["values"]["undergraduate_home_expected_tuition_gbp"], 10050)
        self.assertIn("subject to parliamentary approval", computing["tuition_mandatory_fees"]["cycle"])
        msc = next(row for row in program_coverage if row["program_name"] == "MSc Advanced Computing")
        self.assertEqual(msc["tuition_mandatory_fees"]["status"], "not_catalogued")

    def test_harvard_round_deadlines_and_oxford_root_deadlines_are_included(self):
        harvard = get_university_by_id("harvard-usa-cambridge", localized=True)["coverage_by_level"]
        self.assertEqual(harvard["bachelor"]["deadlines"]["approximate_or_yearless"], "available")
        self.assertEqual(harvard["mba"]["deadlines"]["approximate_or_yearless"], "available")

        oxford = get_university_by_id("university-of-oxford-uk-oxford", localized=True)["coverage_by_level"]
        self.assertEqual(oxford["bachelor"]["deadlines"]["exact_dated"], "available")
        self.assertEqual(oxford["mba"]["deadlines"]["exact_dated"], "available")
        self.assertEqual(oxford["master"]["deadlines"]["exact_dated"], "available")
        self.assertEqual(oxford["bachelor"]["costs"]["program_specific"], "available")

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

    def test_mit_bachelor_programs_include_first_year_and_transfer_routes_with_root_cost_guidance(self):
        university = get_university_by_id("mit-usa-cambridge", localized=True)
        program = next(
            row for row in university["coverage_by_program"]
            if row["program_name"] == "Computer Science and Engineering (Course 6-3)"
        )

        self.assertEqual(program["program_id"], "mit-course-6-3-bachelor")
        self.assertEqual(program["requirements"]["status"], "available")
        referenced_program_ids = {
            str(program_id)
            for category in university["admission_categories"]
            for program_id in category.get("program_ids", [])
        }
        self.assertIn(program["program_id"], referenced_program_ids)
        self.assertEqual(program["deadline"]["scope"], "shared_admission_route")
        self.assertEqual(program["deadline"]["status"], "exact_dated")
        self.assertEqual(program["deadline"]["cycle"], "Spring 2027 entry")
        self.assertIn("January 4", program["deadline"]["values"])
        first_year_values = [value for value in program["deadline"]["values"] if isinstance(value, str)]
        self.assertTrue(any("Fall 2027 entry: March 1, 2027" in value for value in first_year_values))
        transfer_deadlines = [
            value for value in program["deadline"]["values"]
            if isinstance(value, dict) and value.get("admission_route_id") == "mit_undergrad_transfer"
        ]
        self.assertTrue(any(value.get("applicant_category") == "transfer_applicant" for value in transfer_deadlines))
        self.assertIn(("2026-10-15", "Spring 2027 entry"), {
            (value.get("date"), value.get("cycle")) for value in transfer_deadlines
        })
        self.assertIn(("2027-03-01", "Fall 2027 entry"), {
            (value.get("date"), value.get("cycle")) for value in transfer_deadlines
        })
        self.assertEqual(program["tuition_mandatory_fees"]["scope"], "university_guidance")
        self.assertNotIn("tuition_free_income_threshold_usd", program["tuition_mandatory_fees"]["values"])
        award = program["awards"]["items"][0]
        self.assertEqual(award["source_url"], "https://sfs.mit.edu/undergraduate-students/apply-for-aid/international/")
        self.assertEqual(award["cycle"], "2027 entry")
        self.assertEqual(award["verified_at"], "2026-09-23")

    def test_oxford_graduate_deadline_and_clarendon_have_course_provenance(self):
        university = get_university_by_id("university-of-oxford-uk-oxford", localized=True)
        for program_id in ("computer_science_ug", "engineering_science_ug"):
            undergraduate = next(
                row for row in university["coverage_by_program"]
                if row["program_id"] == program_id
            )
            self.assertEqual(undergraduate["study_levels"], ["bachelor"])
            self.assertFalse(
                any(award["id"] == "oxford-clarendon-fund-2027" for award in undergraduate["awards"]["items"]),
                program_id,
            )
        ppe = next(
            row for row in university["coverage_by_program"]
            if row["program_name"] == "Philosophy, Politics and Economics (PPE)"
        )
        self.assertEqual(ppe["deadline"]["status"], "exact_dated")
        self.assertEqual(ppe["deadline"]["scope"], "university_guidance")
        self.assertEqual(ppe["deadline"]["cycle"], "2027 entry")
        self.assertEqual(
            ppe["deadline"]["source_url"],
            "https://www.ox.ac.uk/admissions/undergraduate/applying/admissions-timeline",
        )
        self.assertEqual(ppe["deadline"]["verified_at"], "2026-09-24")
        self.assertEqual(
            [(item["deadline_type"], item["date"]) for item in ppe["deadline"]["values"]],
            [("course_application", "2026-10-15")],
        )
        cs = next(
            row for row in university["coverage_by_program"]
            if row["program_id"] == "computer_science_ug"
        )
        cs_deadlines = cs["deadline"]["values"]
        self.assertEqual(
            [(item["deadline_type"], item["date"]) for item in cs_deadlines],
            [("course_application", "2026-10-15")],
        )
        self.assertNotIn("2026-09-28", [item.get("date") for item in cs_deadlines])
        non_tested = next(
            row for row in university["coverage_by_program"]
            if row["program_id"] == "economics_and_management_ug"
        )
        self.assertEqual(
            [(item["deadline_type"], item["date"]) for item in non_tested["deadline"]["values"]],
            [("course_application", "2026-10-15")],
        )
        program = next(
            row for row in university["coverage_by_program"]
            if row["program_name"] == "MSc in Advanced Computer Science"
        )

        self.assertEqual(program["deadline"]["status"], "exact_dated")
        self.assertEqual(program["deadline"]["scope"], "program_specific")
        self.assertEqual(program["deadline"]["cycle"], "2027-28 entry")
        self.assertIn("6 January 2027", program["deadline"]["values"][0])
        self.assertEqual(program["requirements"]["scope"], "program_specific")
        clarendon = next(award for award in program["awards"]["items"] if award["id"] == "oxford-clarendon-fund-2027")
        self.assertEqual(clarendon["cycle"], "2027-2028")
        self.assertTrue(clarendon["source_url"].startswith("https://www.ox.ac.uk/"))
        self.assertEqual(clarendon["verified_at"], "2026-09-23")

    def test_imperial_computing_phd_department_rounds_are_course_deadlines(self):
        university = get_university_by_id("imperial-college-london-uk", localized=True)
        phd = next(
            row for row in university["coverage_by_program"]
            if row["program_name"] == "PhD in Computing"
        )
        taught = next(
            row for row in university["coverage_by_program"]
            if row["program_name"] == "MSc Advanced Computing"
        )

        self.assertEqual(phd["deadline"]["status"], "exact_dated")
        self.assertEqual(phd["deadline"]["scope"], "program_specific")
        self.assertEqual(phd["deadline"]["cycle"], "2027 entry")
        self.assertEqual(phd["deadline"]["source_url"], "https://www.imperial.ac.uk/computing/prospective-students/phd/")
        self.assertEqual(
            [row["date"] for row in phd["deadline"]["values"] if isinstance(row, dict)],
            ["2026-10-01", "2026-12-01", "2027-02-01", "2027-04-01"],
        )
        self.assertTrue(all("scholarship" not in str(value).lower() for value in phd["deadline"]["values"]))
        self.assertEqual(taught["deadline"]["status"], "exact_dated")
        self.assertEqual(taught["deadline"]["cycle"], "2027 entry")
        self.assertTrue(taught["deadline"]["values"])

    def test_imperial_course_limited_awards_do_not_attach_to_every_degree_at_the_same_level(self):
        university = get_university_by_id("imperial-college-london-uk", localized=True)
        programs = {
            row["program_name"]: {award["id"] for award in row["awards"]["items"]}
            for row in university["coverage_by_program"]
        }
        self.assertIn("imperial-inspires-2027", programs["Computing (BEng)"])
        self.assertNotIn("imperial-inspires-2027", programs["MSc Advanced Computing"])
        self.assertNotIn("deans-impact-scholarship", programs["MSc Advanced Computing"])
        self.assertIn("deans-impact-scholarship", programs["MSc Finance"])
        self.assertNotIn("epsrc-ukri-cdt-studentships", programs["PhD in Computing"])

    def test_hks_award_coverage_keeps_applicant_checklist(self):
        harvard = get_university_by_id("harvard-usa-cambridge", localized=True)
        mpp = next(row for row in harvard["coverage_by_program"] if row["program_name"] == "Public Policy (MPP)")
        award = next(item for item in mpp["awards"]["items"] if item["id"] == "hks-public-service-fellowships-mpp-mpa")
        self.assertTrue(award["steps"])
        self.assertTrue(award["documents"])
        self.assertIn("2027-01-15", award["award_application_deadline"])

    def test_mit_sloan_and_hbs_mba_programs_inherit_only_their_business_route_deadlines(self):
        mit = get_university_by_id("mit-usa-cambridge", localized=True)
        mit_mba = next(
            row for row in mit["coverage_by_program"]
            if row["program_name"] == "Full-Time MBA (Master in Business Administration)"
        )
        self.assertEqual(mit_mba["deadline"]["status"], "exact_dated")
        self.assertEqual(mit_mba["deadline"]["scope"], "program_specific")
        self.assertEqual(mit_mba["deadline"]["source_url"], "https://mitsloan.mit.edu/mba/admissions/how-to-apply")
        self.assertEqual(mit_mba["deadline"]["cycle"], "2027 entry")
        self.assertEqual(mit_mba["deadline"]["verified_at"], "2026-09-24")
        round_one = next(
            row for row in mit_mba["deadline"]["values"]
            if isinstance(row, dict) and row.get("deadline_type") == "round_1"
        )
        self.assertEqual((round_one["date"], round_one["time"], round_one["timezone"]),
                         ("2026-09-29", "15:00", "America/New_York"))
        self.assertIn("mit-sloan-mba-full-time", round_one["program_ids"])

        harvard = get_university_by_id("harvard-usa-cambridge", localized=True)
        hbs_mba = next(
            row for row in harvard["coverage_by_program"]
            if row["program_name"] == "Business Administration (MBA)"
        )
        self.assertEqual(hbs_mba["deadline"]["status"], "exact_dated")
        self.assertEqual(hbs_mba["deadline"]["scope"], "program_specific")
        self.assertEqual(hbs_mba["deadline"]["source_url"], "https://www.hbs.edu/mba/admissions/application-dates")
        self.assertEqual(hbs_mba["deadline"]["cycle"], "MBA Class of 2029; matriculating Fall 2027")
        self.assertEqual(hbs_mba["deadline"]["verified_at"], "2026-09-23")
        self.assertEqual(len(hbs_mba["deadline"]["values"]), 2)

    def test_oxford_program_overseas_annual_fee_is_reported_with_program_provenance(self):
        oxford = get_university_by_id("university-of-oxford-uk-oxford", localized=True)
        program = next(
            row for row in oxford["coverage_by_program"]
            if row["program_name"] == "MSc in Advanced Computer Science"
        )
        fees = program["tuition_mandatory_fees"]
        self.assertEqual(fees["status"], "available")
        self.assertEqual(fees["scope"], "program_specific")
        self.assertEqual(fees["source_url"], "https://www.ox.ac.uk/admissions/graduate/courses/msc-advanced-computer-science")
        self.assertEqual(fees["cycle"], "2027-28 entry")
        self.assertEqual(fees["values"]["home_annual_fee_gbp"], 20100)
        self.assertEqual(fees["values"]["overseas_annual_fee_gbp"], 46350)

    def test_mit_eecs_phd_funding_does_not_attach_to_other_doctorates(self):
        mit = get_university_by_id("mit-usa-cambridge", localized=True)
        eecs = next(row for row in mit["coverage_by_program"] if row["program_id"] == "mit-eecs-phd-course-6")
        mechanical = next(row for row in mit["coverage_by_program"] if row["program_id"] == "mit-meche-phd-course-2")
        self.assertEqual(eecs["requirements"]["scope"], "program_specific")
        self.assertEqual(eecs["deadline"]["status"], "not_catalogued")
        self.assertEqual(eecs["deadline"]["scope"], "not_catalogued")
        self.assertEqual(eecs["deadline"]["publication_status"], "conflicting")
        self.assertEqual(eecs["deadline"]["values"], [])
        self.assertEqual(eecs["deadline"]["source_url"], "https://www.eecs.mit.edu/academics/graduate-programs/admission-process/")
        self.assertEqual(eecs["tuition_mandatory_fees"]["status"], "available")
        self.assertEqual(eecs["tuition_mandatory_fees"]["cycle"].split(";")[0], "2026-27 standard graduate full tuition per fall/spring term")
        self.assertEqual([award["id"] for award in eecs["awards"]["items"]], ["mit-eecs-phd-funding"])
        self.assertFalse(any(award["id"] == "mit-eecs-phd-funding" for award in mechanical["awards"]["items"]))

    def test_stanford_mba_fellowship_and_oxford_course_award_are_scoped(self):
        stanford = get_university_by_id("stanford-university-usa-ca", localized=True)["coverage_by_program"]
        mba = next(row for row in stanford if row["program_name"] == "Master of Business Administration (MBA)")
        jd = next(row for row in stanford if row["program_name"] == "Juris Doctor (JD)")
        fellowship = "stanford-gsb-need-based-mba-fellowship"
        self.assertIn(fellowship, [award["id"] for award in mba["awards"]["items"]])
        self.assertNotIn(fellowship, [award["id"] for award in jd["awards"]["items"]])

        oxford = get_university_by_id("university-of-oxford-uk-oxford", localized=True)["coverage_by_program"]
        award_id = "oxford-weidenfeld-hoffmann-2027"
        for program_id in ("msc_advanced_computer_science_pgt", "mba_said_business_school_pgt", "bcl_bachelor_of_civil_law_pgt"):
            program = next(row for row in oxford if row["program_id"] == program_id)
            self.assertIn(award_id, [award["id"] for award in program["awards"]["items"]])
        mcf = next(row for row in oxford if row["program_id"] == "msc_mathematical_and_computational_finance_pgt")
        self.assertNotIn(award_id, [award["id"] for award in mcf["awards"]["items"]])

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

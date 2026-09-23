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

        self.assertEqual(program["program_id"], "Course 6-3")
        self.assertEqual(program["requirements"]["scope"], "institution_wide_route")
        self.assertEqual(program["requirements"]["status"], "available")
        self.assertEqual(program["deadline"]["scope"], "shared_admission_route")
        self.assertEqual(program["deadline"]["status"], "exact_dated")
        self.assertEqual(program["deadline"]["cycle"], "Annual first-year cycle; the official page lists recurring dates without naming an entry year.")
        self.assertIn("Fall 2027 entry: March 1, 2027", " ".join(program["deadline"]["values"]))
        self.assertIn("January 4", program["deadline"]["values"])
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
        self.assertEqual(ppe["deadline"]["verified_at"], "2026-09-23")
        self.assertIn("15 October 2026 at 18:00 UK time", ppe["deadline"]["values"][0]["application_deadline"])
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
        self.assertEqual(mit_mba["deadline"]["verified_at"], "2026-09-23")
        self.assertIn("September 29, 2026", mit_mba["deadline"]["values"][0])

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
        self.assertEqual(eecs["deadline"]["status"], "exact_dated")
        self.assertEqual(eecs["deadline"]["scope"], "program_specific")
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


if __name__ == "__main__":
    unittest.main()

from __future__ import annotations

import json
import unittest

from scripts.audit_universities_data import DEFAULT_DATA_PATH, _audit_top_five_pilot


class TopFiveUniversityAuditTests(unittest.TestCase):
    def setUp(self) -> None:
        self.university = {
            "deadlines": {
                "undergraduate": {
                    "application_deadline": "15 October 2026 at 18:00 UK time",
                    "cycle": "2027 entry",
                    "source_url": "https://www.ox.ac.uk/admissions/undergraduate/applying/admissions-timeline",
                    "verified_at": "2026-09-23",
                },
                "graduate_taught_masters": {
                    "scholarship_deadline_guidance": "Check the course page for its exact deadline.",
                    "cycle": "2027-28 entry",
                    "scope": "Graduate taught courses; deadlines vary by course",
                    "source_url": "https://www.ox.ac.uk/admissions/graduate/application-guide/starting-your-application/when-to-apply",
                    "verified_at": "2026-09-23",
                },
            },
            "finance": {
                "currency": "USD",
                "academic_year": "2026-27",
                "fee_status": "Overseas undergraduate estimate",
                "scope": "Undergraduate tuition plus living costs",
                "verified_at": "2026-09-23",
                "costs_breakdown_year_usd": {"Tuition": 50000, "Living": 20000},
                "costs_breakdown_source_urls": [
                    "https://www.ox.ac.uk/admissions/undergraduate/fees-and-funding/course-fees"
                ],
            },
            "admission_categories": [
                {
                    "id": "oxford_bachelor",
                    "scope": "undergraduate_general",
                    "study_levels": ["Bachelor"],
                    "application_deadline": "15 October 2026",
                    "cycle": "2027 entry",
                    "source_url": "https://www.ox.ac.uk/admissions/undergraduate/applying/admissions-timeline",
                    "verified_at": "2026-09-23",
                }
            ],
        }

    def audit(self, uid: str = "university-of-oxford-uk-oxford") -> list[str]:
        errors: list[str] = []
        _audit_top_five_pilot(errors, uid, self.university)
        return errors

    def test_accepts_scoped_deadlines_official_sources_and_finance_breakdown(self) -> None:
        self.assertEqual([], self.audit())

    def test_rejects_admission_scope_that_conflicts_with_study_level(self) -> None:
        self.university["admission_categories"][0]["scope"] = "graduate_business"
        self.assertTrue(any("study_levels do not match scope" in error for error in self.audit()))

    def test_rejects_deadline_without_cycle_or_university_source(self) -> None:
        del self.university["deadlines"]["undergraduate"]["cycle"]
        self.university["deadlines"]["undergraduate"]["source_url"] = (
            "https://www.imperial.ac.uk/admissions"
        )
        errors = self.audit()
        self.assertTrue(any("cycle is required" in error for error in errors))
        self.assertTrue(any("links outside the university's official domains" in error for error in errors))

    def test_rejects_finance_breakdown_without_official_sources_or_with_negative_values(self) -> None:
        finance = self.university["finance"]
        finance["costs_breakdown_year_usd"]["Tuition"] = -1
        finance["costs_breakdown_source_urls"] = []
        errors = self.audit()
        self.assertTrue(any("non-negative numeric values" in error for error in errors))
        self.assertTrue(any("costs_breakdown_source_urls is required" in error for error in errors))

    def test_rejects_foreign_host_inside_finance_source_url_list(self) -> None:
        self.university["finance"]["costs_breakdown_source_urls"] = [
            "https://www.example.org/tuition"
        ]
        errors = self.audit()
        self.assertTrue(any(
            "finance.costs_breakdown_source_urls[0] links outside the university's official domains"
            in error
            for error in errors
        ))

    def test_rejects_costs_without_year_scope_fee_status_or_verification_date(self) -> None:
        for key in ("academic_year", "scope", "fee_status", "verified_at"):
            self.university["finance"].pop(key)
        errors = self.audit()
        self.assertTrue(any("finance.academic_year is required" in error for error in errors))
        self.assertTrue(any("finance.scope is required" in error for error in errors))
        self.assertTrue(any("finance.fee_status is required" in error for error in errors))
        self.assertTrue(any("finance.verified_at is required" in error for error in errors))

    def test_rejects_non_usd_values_in_usd_breakdown(self) -> None:
        self.university["finance"]["currency"] = "GBP"
        self.assertTrue(any("requires USD currency" in error for error in self.audit()))

    def test_rejects_application_fee_without_current_source_metadata(self) -> None:
        category = self.university["admission_categories"][0]
        category["application_fee_gbp"] = 34.5
        category.pop("cycle")
        category.pop("source_url")
        category.pop("verified_at", None)
        errors = self.audit()
        self.assertTrue(any("cycle is required for application fee data" in error for error in errors))
        self.assertTrue(any("source_url is required for application fee data" in error for error in errors))
        self.assertTrue(any("verified_at is required for application fee data" in error for error in errors))

    def test_rejects_negative_or_textual_application_fee_values(self) -> None:
        self.university["admission_categories"][0]["application_fee_by_program_gbp"] = {
            "MSc": -1,
            "MBA": "150 GBP",
        }
        errors = self.audit()
        self.assertTrue(any("application_fee_by_program_gbp must contain non-negative numeric" in error for error in errors))

    def test_rejects_non_iso_verification_date_for_deadline(self) -> None:
        self.university["deadlines"]["undergraduate"]["verified_at"] = "yesterday"
        self.assertTrue(any("verified_at must be valid YYYY-MM-DD date" in error for error in self.audit()))

    def test_legacy_university_is_not_subject_to_pilot_specific_checks(self) -> None:
        self.university["admission_categories"][0]["scope"] = "legacy_unknown_scope"
        self.assertEqual([], self.audit("university-outside-pilot"))

    def test_annual_first_year_deadlines_do_not_infer_an_entry_year(self) -> None:
        rows = {row["id"]: row for row in json.loads(DEFAULT_DATA_PATH.read_text(encoding="utf-8"))}
        mit = rows["mit-usa-cambridge"]
        mit_first_year = [
            category for category in mit["admission_categories"]
            if category["id"] in {"mit_regular", "mit_undergrad_early_action"}
        ]
        self.assertEqual(2, len(mit_first_year))
        self.assertTrue(all("Annual first-year cycle" in category["cycle"] for category in mit_first_year))
        doctoral_funding = mit["finance"]["doctorate_funding_guarantee"]
        self.assertIsNone(doctoral_funding["guaranteed"])
        self.assertIsNone(doctoral_funding["stipend_annual_usd_min"])
        self.assertIn("varies significantly by program", doctoral_funding["notes"])

        stanford = rows["stanford-university-usa-ca"]
        stanford_first_year = next(
            category for category in stanford["admission_categories"]
            if category["id"] == "stanford_standard"
        )
        self.assertIn("without naming an entry year", stanford_first_year["cycle"])
        for round_row in stanford_first_year["deadlines"]:
            self.assertFalse(any("20" in value for value in round_row.values() if isinstance(value, str)))

        harvard = rows["harvard-usa-cambridge"]
        harvard_first_year = next(
            category for category in harvard["admission_categories"]
            if category["id"] == "harvard_college"
        )
        # Current catalog coverage is scoped to the Fall 2027 cohort; Harvard
        # publishes the round deadlines as month/day values without a year.
        self.assertEqual("Fall 2027 first-year admission", harvard_first_year["cycle"])
        self.assertTrue(all("20" not in round_row["deadline"] for round_row in harvard_first_year["admission_rounds"]))

    def test_harvard_budget_and_program_scoped_costs_remain_explicit(self) -> None:
        rows = {row["id"]: row for row in json.loads(DEFAULT_DATA_PATH.read_text(encoding="utf-8"))}
        harvard_finance = rows["harvard-usa-cambridge"]["finance"]
        self.assertEqual("USD", harvard_finance["currency"])
        self.assertEqual("2026-27", harvard_finance["academic_year"])
        self.assertIn("Harvard College undergraduate", harvard_finance["scope"])
        self.assertEqual(95134, harvard_finance["total_cost_year_min"])
        self.assertEqual(100134, harvard_finance["total_cost_year_max"])
        self.assertNotIn("total_cost_year_usd", harvard_finance)

        imperial = rows["imperial-college-london-uk"]["finance"]
        oxford = rows["university-of-oxford-uk-oxford"]["finance"]
        for finance in (imperial, oxford):
            self.assertEqual("GBP", finance["currency"])
            self.assertNotIn("total_cost_year_usd", finance)
            self.assertNotIn("total_cost_year_min", finance)
            self.assertNotIn("total_cost_year_max", finance)
        oxford_cs = next(
            category for category in rows["university-of-oxford-uk-oxford"]["admission_categories"]
            if category["id"] == "university_of_oxford_uk_oxford_computer_science_undergraduate"
        )["finance_override"]
        self.assertEqual("GBP", oxford_cs["currency"])
        self.assertEqual(79855, oxford_cs["total_cost_year_min"])
        self.assertEqual(86155, oxford_cs["total_cost_year_max"])

    def test_current_graduate_deadlines_are_program_and_cycle_scoped(self) -> None:
        rows = {row["id"]: row for row in json.loads(DEFAULT_DATA_PATH.read_text(encoding="utf-8"))}
        harvard_categories = {
            category["id"]: category
            for category in rows["harvard-usa-cambridge"]["admission_categories"]
        }

        hbs = harvard_categories["harvard_hbs_mba"]
        self.assertEqual("MBA Class of 2029; matriculating Fall 2027", hbs["cycle"])
        self.assertEqual("https://www.hbs.edu/mba/admissions/application-dates", hbs["source_url"])
        self.assertEqual(250, hbs["application_fee_usd"])
        self.assertTrue(hbs["application_fee_source_url"].startswith("https://apply.hbs.edu/"))
        self.assertEqual("September 9, 2026 at 12:00 p.m. ET", hbs["admission_rounds"][0]["deadline"])
        self.assertEqual("December 10, 2026", hbs["admission_rounds"][0]["notification"])
        self.assertEqual("January 5, 2027 at 12:00 p.m. ET", hbs["admission_rounds"][1]["deadline"])
        self.assertEqual("March 25, 2027", hbs["admission_rounds"][1]["notification"])

        hks = harvard_categories["harvard_hks_mpp"]
        self.assertEqual("2027-2028 academic year", hks["cycle"])
        self.assertEqual("December 1, 2026 at 12:00 p.m. (noon) ET", hks["admission_rounds"][0]["deadline"])
        self.assertEqual("January 15, 2027 at 12:00 p.m. (noon) ET", hks["admission_rounds"][0]["financial_aid_deadline"])
        self.assertEqual(100, hks["application_fee_usd"])
        self.assertTrue(hks["application_fee_source_url"].startswith("https://www.hks.harvard.edu/"))

        hls = harvard_categories["harvard_hls_jd"]
        self.assertTrue(hls["cycle"].startswith("Fall 2027"))
        self.assertEqual(90, hls["application_fee_usd"])
        self.assertEqual("February 5, 2027 at 11:59 p.m. ET", hls["admission_rounds"][0]["deadline"])

        gsas = harvard_categories["harvard_gsas_phd"]
        self.assertEqual("2027-28 entry", gsas["cycle"])
        self.assertEqual(105, gsas["application_fee_usd"])
        self.assertIn("Varies by degree program", gsas["admission_rounds"][0]["deadline"])
        self.assertNotIn("December 1 - December 15", gsas["admission_rounds"][0]["deadline"])

    def test_stanford_phd_dates_are_not_presented_as_a_university_wide_deadline(self) -> None:
        rows = {row["id"]: row for row in json.loads(DEFAULT_DATA_PATH.read_text(encoding="utf-8"))}
        category = next(
            item for item in rows["stanford-university-usa-ca"]["admission_categories"]
            if item["id"] == "stanford_phd_doctoral_track"
        )
        deadline = category["deadlines"][0]
        self.assertIn("Set by the intended graduate program", deadline["application_deadline"])
        self.assertIn("set their own dates", deadline["notes"])
        self.assertIn("https://www.cs.stanford.edu/admissions-graduate-application-deadlines", deadline["source_urls"])
        self.assertIn("https://biosciences.stanford.edu/how-to-apply/", deadline["source_urls"])
        self.assertNotIn("2026-12-01 to 2026-12-15", deadline["application_deadline"])

    def test_imperial_presidents_phd_rounds_use_the_current_scholarship_source(self) -> None:
        rows = {row["id"]: row for row in json.loads(DEFAULT_DATA_PATH.read_text(encoding="utf-8"))}
        category = next(
            item for item in rows["imperial-college-london-uk"]["admission_categories"]
            if item["id"] == "imperial_pgr_phd_doctoral"
        )
        scholarship_source = "https://www.imperial.ac.uk/study/fees-and-funding/postgraduate-doctoral/grants-scholarships/presidents-phd/"
        self.assertTrue(all(row["source_url"] == scholarship_source for row in category["deadlines"]))
        self.assertTrue(all("President's PhD Scholarships" in row["notes"] for row in category["deadlines"]))
        self.assertTrue(all("not the general PhD admission deadline" in row["notes"] for row in category["deadlines"]))

    def test_imperial_2027_taught_rounds_are_course_scoped(self) -> None:
        rows = {row["id"]: row for row in json.loads(DEFAULT_DATA_PATH.read_text(encoding="utf-8"))}
        programs = {row["id"]: row for row in rows["imperial-college-london-uk"]["academics"]["programs"]}
        expected = {
            "imperial-msc-advanced-computing": ["2027-01-06", "2027-03-10", "2027-04-28"],
            "imperial-msc-artificial-intelligence": ["2027-01-06", "2027-03-10", "2027-04-28"],
            "imperial-msc-biomedical-engineering": ["2027-01-06", "2027-03-10", "2027-04-28"],
            "imperial-msc-financial-technology": ["2026-09-29", "2027-01-06", "2027-03-10", "2027-04-28"],
            "imperial-msc-finance": ["2026-09-29", "2027-01-06", "2027-03-10", "2027-04-28"],
            "imperial-full-time-mba": ["2026-09-22", "2027-01-12", "2027-03-16", "2027-05-11"],
        }
        for program_id, dates in expected.items():
            with self.subTest(program=program_id):
                program = programs[program_id]
                self.assertEqual([row["date"] for row in program["deadlines"]], dates)
                self.assertTrue(all(row["cycle"] == "2027 entry" for row in program["deadlines"]))
                self.assertTrue(all(row["source_url"] == program["source_url"] for row in program["deadlines"]))

    def test_oxford_route_ids_and_aid_scopes_match_current_course_cards(self) -> None:
        rows = {row["id"]: row for row in json.loads(DEFAULT_DATA_PATH.read_text(encoding="utf-8"))}
        oxford = rows["university-of-oxford-uk-oxford"]
        categories = {row["id"]: row for row in oxford["admission_categories"]}
        programs = {row["id"]: row for row in oxford["academics"]["programs"]}

        self.assertEqual(
            categories["university_of_oxford_uk_oxford_computer_science_undergraduate"]["program_ids"],
            ["computer_science_ug"],
        )
        self.assertEqual(
            categories["university_of_oxford_uk_oxford_mathematics_and_computer_science_undergraduate"]["program_ids"],
            ["mathematics_and_computer_science_ug"],
        )
        self.assertEqual(
            set(categories["oxford_ppe_and_humanities"]["program_ids"]),
            {"philosophy_politics_and_economics_ppe_ug", "law_jurisprudence_ug"},
        )
        self.assertEqual(categories["oxford_pgt_mst_history"]["program_ids"], ["mst_history_pgt"])
        self.assertEqual(programs["bcl_bachelor_of_civil_law_pgt"]["study_levels"], ["Master"])
        self.assertEqual(programs["mst_history_pgt"]["part_time_home_annual_fee_gbp"], 9490)
        self.assertEqual(programs["mst_history_pgt"]["part_time_overseas_annual_fee_gbp"], 23175)

        awards = {row["id"]: row for row in oxford["finance"]["scholarships_and_funding"]}
        reach = awards["oxford-reach-oxford-scholarship-2027"]
        self.assertEqual(len(reach["program_ids"]), 8)
        self.assertNotIn("medicine_ug", reach["program_ids"])
        self.assertEqual(
            set(awards["oxford-clarendon-fund-2027"]["program_ids"]),
            {
                "msc_advanced_computer_science_pgt",
                "msc_mathematical_and_computational_finance_pgt",
                "mba_said_business_school_pgt",
                "bcl_bachelor_of_civil_law_pgt",
                "mst_history_pgt",
                "dphil_computer_science_pgr",
                "dphil_law_pgr",
            },
        )
        self.assertEqual(
            awards["oxford-weidenfeld-hoffmann-2027"]["program_ids"],
            ["msc_advanced_computer_science_pgt", "mba_said_business_school_pgt", "bcl_bachelor_of_civil_law_pgt"],
        )

    def test_oxford_2027_undergraduate_fees_keep_course_and_medicine_phase(self) -> None:
        rows = {row["id"]: row for row in json.loads(DEFAULT_DATA_PATH.read_text(encoding="utf-8"))}
        programs = {row["id"]: row for row in rows["university-of-oxford-uk-oxford"]["academics"]["programs"]}
        overseas_fees = {
            "computer_science_ug": 66580,
            "mathematics_and_computer_science_ug": 66580,
            "engineering_science_ug": 66580,
            "philosophy_politics_and_economics_ppe_ug": 46210,
            "law_jurisprudence_ug": 46210,
            "mathematics_ug": 50420,
            "physics_ug": 66580,
            "economics_and_management_ug": 46210,
            "medicine_ug": 52360,
        }
        for program_id, overseas_fee in overseas_fees.items():
            with self.subTest(program=program_id):
                program = programs[program_id]
                self.assertEqual(program["home_annual_fee_gbp"], 10050)
                self.assertEqual(program["overseas_annual_fee_gbp"], overseas_fee)
                self.assertEqual(program["tuition_source_url"], program["url"])
        medicine = programs["medicine_ug"]
        self.assertEqual(medicine["study_levels"], ["Bachelor"])
        self.assertIn("pre-clinical years 1-3 only", medicine["tuition_cycle"])
        self.assertIn("not yet confirmed", medicine["tuition_note"])


if __name__ == "__main__":
    unittest.main()

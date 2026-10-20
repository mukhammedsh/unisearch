from __future__ import annotations

import json
import unittest
from urllib.parse import urlparse

from app.services import admissions_catalog
from scripts.audit_universities_data import DEFAULT_DATA_PATH


class ActiveFundingDataTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        rows = json.loads(DEFAULT_DATA_PATH.read_text(encoding="utf-8"))
        cls.legacy_universities = {row["id"]: row for row in rows}

    def resolve(self, university_id: str, **context: str) -> dict:
        return admissions_catalog.resolve_context(university_id, context=context)

    @staticmethod
    def fact(resolved: dict, fact_id: str) -> dict:
        return next(row for row in resolved["facts"] if row["id"] == fact_id)

    @staticmethod
    def source(resolved: dict, source_id: str) -> dict:
        return next(row for row in resolved["sources"] if row["id"] == source_id)

    def legacy_awards(self, university_id: str) -> dict[str, dict]:
        finance = self.legacy_universities[university_id].get("finance", {})
        return {row["id"]: row for row in finance.get("scholarships_and_funding", [])}

    def test_legacy_harvard_and_oxford_awards_keep_scoped_official_records(self) -> None:
        expected = {
            "harvard-usa-cambridge": {
                "harvard-college-need-based-financial-aid",
                "hbs-need-based-mba-fellowship",
                "hks-public-service-fellowships-mpp-mpa",
                "hls-jd-need-based-grant",
            },
            "university-of-oxford-uk-oxford": {
                "oxford-reach-oxford-scholarship-2027",
                "oxford-clarendon-fund-2027",
            },
        }
        for university_id, award_ids in expected.items():
            awards = self.legacy_awards(university_id)
            self.assertTrue(award_ids.issubset(awards), university_id)
            for award_id in award_ids:
                award = awards[award_id]
                self.assertTrue(award["program_scope"], f"{university_id}:{award_id}")
                self.assertTrue(award["applicant_scope"], f"{university_id}:{award_id}")
                self.assertTrue(award["academic_year"], f"{university_id}:{award_id}")
                self.assertTrue(award["source_url"].startswith("https://"), f"{university_id}:{award_id}")

    def test_legacy_oxford_reach_award_has_its_published_2027_deadline(self) -> None:
        award = self.legacy_awards("university-of-oxford-uk-oxford")["oxford-reach-oxford-scholarship-2027"]
        self.assertEqual(
            {"date": "2027-01-26", "time": "12:00", "label": "Scholarship application deadline"},
            award["award_application_deadline"],
        )
        self.assertEqual("UK time", award["deadline_timezone"])

    def test_legacy_harvard_admitted_score_ranges_are_not_minimums(self) -> None:
        university = self.legacy_universities["harvard-usa-cambridge"]
        category = next(row for row in university["admission_categories"] if row["id"] == "harvard_college")
        for profile in category.get("requirement_profiles", []):
            self.assertFalse({"SAT", "ACT", "GPA"}.intersection(profile.get("requirements", {})))
            self.assertTrue(profile.get("requirements_note"))
            self.assertTrue(profile.get("requirements_source_url"))

    def test_mit_first_year_aid_is_scoped_to_route_and_not_an_individual_award(self) -> None:
        resolved = self.resolve(
            "mit-usa-cambridge",
            study_option_id="mit-course-6-3-bachelor",
            application_route_id="mit-first-year",
            study_level="undergraduate",
            applicant_route="first_year",
            intended_entry_cycle="Fall 2027 entry",
        )
        funding = self.fact(resolved, "mit-first-year-funding-0-1")

        self.assertEqual("mit-first-year", resolved["selected_route"]["id"])
        self.assertEqual(["source-6267f8d874684442"], funding["source_ids"])
        self.assertEqual("matched", funding["applicability"]["route"])
        self.assertIn("Funding consideration is not a confirmed individual award", funding["attributes"]["summary"])
        self.assertEqual("mitadmissions.org", urlparse(self.source(resolved, funding["source_ids"][0])["url"]).hostname)

    def test_imperial_doctoral_scholarship_keeps_scope_cycle_and_source(self) -> None:
        resolved = self.resolve(
            "imperial-college-london-uk",
            study_option_id="imperial-computing-phd",
            application_route_id="procedure-computing-phd",
            study_level="doctoral",
            applicant_route="graduate",
            intended_entry_cycle="2027-28",
        )
        funding = self.fact(resolved, "imperial-president-phd-funding")

        self.assertEqual("imperial-computing-phd", resolved["selected_option"]["id"])
        self.assertEqual(["source-18197230481cd350"], funding["source_ids"])
        self.assertEqual("2027-28", funding["scope"]["cycle"])
        self.assertIn("unable to support international", funding["value"]["eligibility"])
        self.assertIn("2027/28 awards", funding["value"]["renewal"])
        self.assertEqual("www.imperial.ac.uk", urlparse(self.source(resolved, funding["source_ids"][0])["url"]).hostname)

    def test_imperial_inspires_stays_an_overseas_course_opportunity_not_a_confirmed_award(self) -> None:
        resolved = self.resolve(
            "imperial-college-london-uk",
            study_option_id="imperial-option-computing-meng",
            application_route_id="procedure-computing-meng",
            study_level="undergraduate",
            applicant_route="first_year",
            intended_entry_cycle="2027 entry",
            fee_status_context="self_reported_international_overseas",
        )
        funding = self.fact(resolved, "imperial-inspires-2027-contract")

        self.assertEqual(["Overseas"], funding["scope"]["fee_status"])
        self.assertEqual(["source-422317aba5a39e29", "imperial-recheck-20261020-50"], funding["source_ids"])
        self.assertIn("selected postgraduate taught course", funding["scope"]["applicant_categories"][0])
        self.assertIn("at least £15,000 per year", funding["value"])
        self.assertNotIn("awarded_amount", funding["value"])
        hostname = urlparse(self.source(resolved, funding["source_ids"][0])["url"]).hostname or ""
        self.assertTrue(hostname == "imperial.ac.uk" or hostname.endswith(".imperial.ac.uk"))

    def test_stanford_international_aid_keeps_admission_condition_and_exact_filing_dates(self) -> None:
        resolved = self.resolve(
            "stanford-university-usa-ca",
            study_option_id="stanford-option-cs-bs",
            application_route_id="undergraduate-shared-evidence:stanford-first-year",
            study_level="undergraduate",
            applicant_route="international",
            intended_entry_cycle="Autumn 2027",
        )
        admission = self.fact(resolved, "undergraduate-shared-evidence:stanford-ug-international-financial-aid-admission")
        deadlines = self.fact(resolved, "undergraduate-shared-evidence:stanford-ug-aid-deadlines")
        funding = self.fact(resolved, "undergraduate-shared-evidence:stanford-ug-aid-need-and-scholarship")

        self.assertEqual(["undergraduate-shared-evidence:stanford-ug-international"], admission["source_ids"])
        self.assertIn("requesting aid is a factor in admission evaluation", admission["value"])
        self.assertEqual(["undergraduate-shared-evidence:stanford-ug-aid-dates"], deadlines["source_ids"])
        self.assertIn("REA November 15", deadlines["value"])
        self.assertIn("RD February 15", deadlines["value"])
        self.assertIn("transfer March 15", deadlines["value"])
        self.assertEqual("unknown", deadlines["applicability"]["cycle"])
        self.assertIn("meets demonstrated need", funding["value"])
        self.assertNotIn("award_amount", funding["value"])
        self.assertIn("need-based", funding["value"])


if __name__ == "__main__":
    unittest.main()

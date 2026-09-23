import json
import unittest
from pathlib import Path

from app.services.university_coverage import build_coverage_by_program


DATA_PATH = Path(__file__).resolve().parents[1] / "data" / "universities.json"


class HarvardProgramCoverageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        universities = json.loads(DATA_PATH.read_text(encoding="utf-8"))
        cls.harvard = next(
            university
            for university in universities
            if university["id"] == "harvard-usa-cambridge"
        )
        cls.categories = {
            category["id"]: category
            for category in cls.harvard["admission_categories"]
        }
        cls.coverage = {
            row["program_id"]: row for row in build_coverage_by_program(cls.harvard)
        }

    def test_hbs_mba_has_cycle_specific_application_checklist_and_tuition(self):
        mba = self.categories["harvard_hbs_mba"]
        profile = mba["requirement_profiles"][0]

        self.assertEqual(mba["cycle"], "MBA Class of 2029; matriculating Fall 2027")
        self.assertEqual(len(mba["admission_rounds"]), 2)
        self.assertIn(
            "Two online recommendations (HBS prefers one current or former supervisor)",
            profile["application_materials"],
        )
        self.assertIn("24 hours", profile["interview_and_post_interview"])
        paid = next(item for item in mba["funding_options"] if item["id"] == "hbs_self_funded")
        self.assertEqual(paid["tuition_year_usd"], 84760)
        self.assertEqual(paid["tuition_academic_year"], "2026-27")
        self.assertTrue(paid["tuition_source_url"].startswith("https://www.hbs.edu/"))

    def test_hks_mpp_and_mpa_have_separate_prerequisites_and_scoped_2026_27_fees(self):
        hks = self.categories["harvard_hks_mpp"]
        profiles = {profile["id"]: profile for profile in hks["requirement_profiles"]}
        mpp = profiles["hks_mpp_profile"]
        mpa = profiles["hks_mpa_profile"]

        self.assertEqual(mpp["application_cycle"], "2027-2028 academic year")
        self.assertIn("not required", mpp["eligibility"])
        self.assertIn("three years", mpa["eligibility"])
        self.assertIn("four qualifying graduate-level courses", mpa["eligibility"])
        for profile in (mpp, mpa):
            self.assertEqual(profile["application_deadline"], "2026-12-01 12:00 ET")
            self.assertEqual(profile["financial_aid_deadline"], "2027-01-15 12:00 ET")
            self.assertEqual(profile["tuition_year_usd"], 72106)
            self.assertEqual(profile["tuition_academic_year"], "2026-27")
            self.assertIn("not total cost of attendance", profile["tuition_scope"])
            self.assertEqual(len(profile["application_materials"]), 8)
            self.assertTrue(profile["tuition_source_url"].startswith("https://www.hks.harvard.edu/"))

    def test_hls_jd_is_professional_and_has_separate_test_and_application_deadlines(self):
        jd = self.categories["harvard_hls_jd"]
        profile = jd["requirement_profiles"][0]

        self.assertEqual(jd["degree_type"], "professional_doctorate")
        self.assertEqual(jd["scope"], "program_group")
        self.assertEqual(jd["testing_deadline"], "2027-02-01")
        self.assertEqual(jd["application_deadline"], "2027-02-05 23:59 ET")
        self.assertIn(
            "Two letters of recommendation required; up to three accepted through LSAC; at least one academic recommender is strongly recommended",
            profile["application_materials"],
        )
        self.assertIn("Statement of Purpose and Statement of Perspective", " ".join(profile["application_materials"]))
        paid = next(item for item in jd["funding_options"] if item["id"] == "hls_paid")
        self.assertEqual(paid["tuition_year_usd"], 84400)
        self.assertEqual(paid["tuition_academic_year"], "2026-27")
        self.assertTrue(paid["tuition_source_url"].startswith("https://hls.harvard.edu/"))

    def test_coverage_api_receives_program_scoped_facts_and_cycles(self):
        expected = {
            "harvard-hbs-mba": ("MBA Class of 2029; matriculating Fall 2027", 84760),
            "harvard-hks-mpp": ("2027-2028 academic year", 72106),
            "harvard-hks-mpa": ("2027-2028 academic year", 72106),
            "harvard-hls-jd": ("Fall 2027 enrollment", 84400),
        }
        for program_id, (admission_cycle, tuition) in expected.items():
            with self.subTest(program_id=program_id):
                row = self.coverage[program_id]
                self.assertEqual(row["requirements"]["status"], "available")
                self.assertEqual(row["requirements"]["cycle"], admission_cycle)
                self.assertEqual(row["deadline"]["status"], "exact_dated")
                self.assertEqual(row["tuition_mandatory_fees"]["status"], "available")
                self.assertEqual(row["tuition_mandatory_fees"]["cycle"], "2026-27")
                self.assertEqual(
                    row["tuition_mandatory_fees"]["values"]["tuition_year_usd"], tuition
                )
                self.assertEqual(row["awards"]["status"], "available")
                self.assertTrue(row["awards"]["items"])
                if program_id in {"harvard-hks-mpp", "harvard-hks-mpa"}:
                    hks_award = next(
                        award
                        for award in self.harvard["finance"]["scholarships_and_funding"]
                        if award["id"] == "hks-public-service-fellowships-mpp-mpa"
                    )
                    self.assertTrue(hks_award["steps"])
                    self.assertTrue(hks_award["documents"])
                    self.assertIn("does not publish one universal", hks_award["document_scope_note"])


if __name__ == "__main__":
    unittest.main()

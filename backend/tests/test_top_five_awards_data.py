from __future__ import annotations

import json
import unittest

from scripts.audit_universities_data import DEFAULT_DATA_PATH


class TopFiveAwardsDataTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        rows = json.loads(DEFAULT_DATA_PATH.read_text(encoding="utf-8"))
        cls.universities = {row["id"]: row for row in rows}

    def awards(self, university_id: str) -> dict[str, dict]:
        finance = self.universities[university_id].get("finance", {})
        return {
            award["id"]: award
            for award in finance.get("scholarships_and_funding", [])
        }

    def test_named_awards_have_actionable_scope_and_official_sources(self) -> None:
        expected = {
            "mit-usa-cambridge": {"mit-undergraduate-need-based-scholarship"},
            "stanford-university-usa-ca": {
                "stanford-international-undergraduate-need-based-aid",
                "stanford-knight-hennessy-scholars-2027",
            },
            "harvard-usa-cambridge": {
                "harvard-college-need-based-financial-aid",
                "hbs-need-based-mba-fellowship",
                "hks-public-service-fellowships-mpp-mpa",
                "hls-jd-need-based-grant-and-lipp",
            },
            "university-of-oxford-uk-oxford": {
                "oxford-reach-oxford-scholarship-2027",
                "oxford-clarendon-fund-2027",
            },
            "imperial-college-london-uk": {
                "imperial-inspires-2027",
                "presidents-phd-scholarships",
                "deans-impact-scholarship",
            },
        }
        for university_id, award_ids in expected.items():
            awards = self.awards(university_id)
            self.assertTrue(award_ids.issubset(awards), university_id)
            for award_id in award_ids:
                award = awards[award_id]
                for key in (
                    "name", "study_level", "program_scope", "applicant_scope",
                    "academic_year", "basis", "application_process", "eligibility",
                    "coverage", "renewal", "competition", "course_application_deadline",
                    "award_application_deadline", "deadline_timezone", "steps", "documents",
                    "source_url", "verified_at",
                ):
                    self.assertIn(key, award, f"{university_id}:{award_id}:{key}")
                self.assertIn(award["basis"], {"need", "merit", "need_and_merit"})
                self.assertIn(award["application_process"], {"automatic", "separate", "post_offer", "course_application_selection"})
                self.assertTrue(award["steps"])
                self.assertTrue(award["source_url"].startswith("https://"))

    def test_mit_stanford_and_harvard_do_not_present_admitted_score_benchmarks_as_minima(self) -> None:
        cases = {
            "mit-usa-cambridge": {"mit_regular", "mit_undergrad_early_action"},
            "stanford-university-usa-ca": {"stanford_standard"},
            "harvard-usa-cambridge": {"harvard_college"},
        }
        for university_id, category_ids in cases.items():
            categories = {
                row["id"]: row
                for row in self.universities[university_id]["admission_categories"]
            }
            for category_id in category_ids:
                for profile in categories[category_id].get("requirement_profiles", []):
                    self.assertFalse(
                        {"SAT", "ACT", "GPA"}.intersection(profile.get("requirements", {})),
                        f"{university_id}:{profile['id']} contains unsupported numeric floor",
                    )
                    self.assertTrue(profile.get("requirements_note"))
                    self.assertTrue(profile.get("requirements_source_url"))

        mit = self.universities["mit-usa-cambridge"]["admission_categories"]
        mit_profile = next(
            profile
            for category in mit
            for profile in category.get("requirement_profiles", [])
            if profile["id"] == "mit_regular"
        )
        self.assertEqual(1550, mit_profile["stats_avg"]["SAT"])
        self.assertEqual(1520, mit_profile["score_profile"]["p25_raw"])

    def test_imperial_existing_awards_are_retained_with_new_awards(self) -> None:
        awards = self.awards("imperial-college-london-uk")
        self.assertTrue(
            {
                "presidents-phd-scholarships", "epsrc-ukri-cdt-studentships",
                "deans-impact-scholarship", "imperial-bursary-home-only",
                "imperial-inspires-2027",
            }.issubset(awards)
        )
        presidents = awards["presidents-phd-scholarships"]
        self.assertEqual("course_application_selection", presidents["application_process"])
        self.assertEqual(50, presidents["places_per_year"])
        self.assertEqual(27036, presidents["annual_amount_gbp"])

    def test_award_deadlines_are_not_filled_with_invented_dates(self) -> None:
        awards = self.awards("imperial-college-london-uk")
        self.assertIsNone(awards["imperial-inspires-2027"]["award_application_deadline"])
        self.assertIn("varies by course", awards["imperial-inspires-2027"]["course_application_deadline"])

    def test_reach_oxford_deadline_and_competition_match_the_published_2027_cycle(self) -> None:
        award = self.awards("university-of-oxford-uk-oxford")["oxford-reach-oxford-scholarship-2027"]
        self.assertEqual(
            award["award_application_deadline"],
            {"date": "2027-01-26", "time": "12:00", "label": "Scholarship application deadline"},
        )
        self.assertEqual(award["deadline_timezone"], "UK time")
        self.assertIn("2–3 awards per year", award["competition"])
        self.assertIn("very high", award["competition"])
        self.assertIn(
            "https://www.ox.ac.uk/admissions/undergraduate/applying/admissions-timeline",
            award["source_urls"],
        )

    def test_mit_need_aid_deadlines_link_to_the_official_deadline_page(self) -> None:
        award = self.awards("mit-usa-cambridge")["mit-undergraduate-need-based-scholarship"]
        self.assertIn(
            "https://sfs.mit.edu/undergraduate-students/apply-for-aid/deadlines-process/",
            award["source_urls"],
        )


if __name__ == "__main__":
    unittest.main()

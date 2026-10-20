import unittest

from app.services import admissions_catalog


IMPERIAL = "imperial-college-london-uk"


class ImperialCompletionTests(unittest.TestCase):
    def resolve(self, option, route, level="masters"):
        return admissions_catalog.resolve_context(IMPERIAL, context={
            "study_option_id": option, "application_route_id": route,
            "study_level": level, "applicant_route": "first_year" if level == "undergraduate" else "graduate",
            "intended_entry_cycle": "2027 entry", "fee_status_context": "self_reported_international_overseas",
        })

    def test_joint_rca_programme_keeps_partner_application_and_partial_fee(self):
        result = self.resolve("imperial-option-innovation-design-engineering", "procedure-innovation-design-engineering")
        self.assertEqual(result["selected_route"]["shared_form_family"], "Royal College of Art")
        self.assertIn("rca.ac.uk/study/programme-finder/innovation-design-engineering", result["selected_route"]["destination"])
        price = next(row for row in result["facts"] if row["id"] == "imperial-innovation-design-engineering-course-profile")
        panels = price["value"]["course_page_tuition_fees"]
        self.assertEqual(panels["Home fee"][0]["amounts_and_periods"], ["£20,350 first year", "Second year: TBC"])
        self.assertEqual(panels["Overseas fee"][0]["amounts_and_periods"], ["£47,250 first year", "Second year: TBC"])
        application = next(row for row in result["facts"] if row["id"] == "imperial-ide-rca-2027-application")
        self.assertEqual(application["value"]["application_due"], {"date": "2027-01-08", "time": "12:00", "timezone": "Europe/London"})
        self.assertIn("imperial-recheck-20261020-53", application["source_ids"])

    def test_current_fees_replace_resolved_gaps_without_losing_history_or_mode(self):
        result = self.resolve("imperial-option-conservation-science-practice", "procedure-conservation-science-practice")
        price = next(row for row in result["facts"] if row["id"] == "imperial-conservation-science-practice-course-profile")
        self.assertEqual(price["value"]["course_page_tuition_fees"]["Overseas fee"][0]["amounts_and_periods"],
                         ["Full-time: £35,880 total fee", "Part-time: £17,940 per year"])
        gap_id = "imperial-conservation-science-practice-overseas-fee-2027-tuition"
        self.assertNotIn(gap_id, [row["id"] for row in result["unknowns"]])
        self.assertIn(gap_id, result["history"]["unknown_ids"])
        self.assertTrue(price["attributes"]["previous_reviews"])

    def test_inspires_course_class_cutoff_is_separate_from_invited_form_window(self):
        result = self.resolve("imperial-option-computing", "procedure-computing")
        rows = [row for row in result["facts"] if row["id"].startswith("imperial-inspires-pgt-2027-")]
        self.assertEqual(len(rows), 1)
        value = rows[0]["value"]
        self.assertEqual(value["availability"], "conditional_course_class")
        self.assertEqual(value["deadlines"]["imperial-option-computing"], "2027-04-28")
        self.assertEqual(value["deadline_kind"], "admissions_for_scholarship_consideration")
        self.assertIn("two weeks from invitation", value["application"])
        self.assertIn("no additional written task", value["application"])

    def test_mba_and_online_formats_do_not_inherit_inspires_msc_participation(self):
        for slug in ("full-time-mba", "global-mba"):
            with self.subTest(slug=slug):
                result = self.resolve("imperial-option-" + slug, "procedure-" + slug)
                row = next(row for row in result["facts"] if row["id"].startswith("imperial-inspires-pgt-2027-"))
                self.assertEqual(row["value"]["availability"], "excluded_by_published_course_rules")
                self.assertNotIn("deadlines", row["value"])

    def test_2027_phd_calendar_and_higher_english_have_exact_programme_scope(self):
        result = self.resolve("imperial-computing-phd", "procedure-computing-phd", "doctoral")
        row = next(row for row in result["facts"] if row["id"] == "imperial-computing-phd-2027-round-dates")
        self.assertEqual([item["application_due"] for item in row["value"]["windows"]],
                         ["2026-10-01", "2026-12-01", "2027-02-01", "2027-04-01"])
        undergraduate = self.resolve("imperial-option-medical-science-innovation", "procedure-medical-science-innovation", "undergraduate")
        english = next(row for row in undergraduate["facts"] if row["id"] == "imperial-medical-science-innovation-higher-english-2027")
        self.assertEqual(english["value"]["english_level"], "Higher")
        self.assertNotIn(row["id"], [fact["id"] for fact in undergraduate["facts"]])


if __name__ == "__main__":
    unittest.main()

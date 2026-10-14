from __future__ import annotations

import json
import unittest
from urllib.parse import urlparse

from app.services import admissions_catalog
from scripts.audit_universities_data import DEFAULT_DATA_PATH


LEGACY_GUIDANCE = {
    "harvard-usa-cambridge": {"harvard.edu"},
    "university-of-oxford-uk-oxford": {"ox.ac.uk"},
}


class QualificationGuidanceDataTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        rows = json.loads(DEFAULT_DATA_PATH.read_text(encoding="utf-8"))
        cls.universities = {row["id"]: row for row in rows}

    def test_legacy_guidance_has_cycle_sources_and_valid_statuses(self) -> None:
        for university_id, domains in LEGACY_GUIDANCE.items():
            guidance = self.universities[university_id].get("qualification_guidance")
            self.assertIsInstance(guidance, dict, university_id)
            self.assertTrue(guidance.get("verified_at"), university_id)
            self.assertTrue(guidance.get("scope_note"), university_id)
            self.assertTrue(guidance.get("fallbacks"), university_id)
            for row in [*guidance.get("rules", []), *guidance.get("fallbacks", [])]:
                self.assertIn(row.get("status"), {"accepted", "not_accepted", "needs_review"}, university_id)
                self.assertTrue(row.get("verified_at"), university_id)
                self.assertTrue(row.get("cycle_scope"), university_id)
                url = row.get("source_url")
                self.assertTrue(url and url.startswith("https://"), university_id)
                host = urlparse(url).hostname or ""
                self.assertTrue(any(host == domain or host.endswith("." + domain) for domain in domains), f"{university_id}: {url}")

    def test_oxford_examples_are_exact_and_scoped_to_undergraduate_first_year(self) -> None:
        rules = self.universities["university-of-oxford-uk-oxford"]["qualification_guidance"]["rules"]
        attestat = next(row for row in rules if row["id"] == "oxford-kazakhstan-attestat-undergraduate")
        ib = next(row for row in rules if row["id"] == "oxford-international-baccalaureate-undergraduate")
        self.assertEqual("KZ", attestat["education_country"])
        self.assertEqual({"national_secondary", "other"}, set(attestat["education_credentials_any"]))
        self.assertIn("attestat", attestat["credential_text_matches_any"])
        self.assertIn("svidetel stvo o srednem obrazovanii", attestat["credential_text_matches_any"])
        self.assertEqual("not_accepted", attestat["status"])
        self.assertEqual(["first_year"], attestat["applicant_routes"])
        self.assertEqual("*", ib["education_country"])
        self.assertEqual("ib", ib["education_credential"])
        self.assertEqual("accepted", ib["status"])
        self.assertEqual(["first_year"], ib["applicant_routes"])

    def test_us_context_examples_never_claim_country_level_acceptance(self) -> None:
        rules = self.universities["harvard-usa-cambridge"]["qualification_guidance"]["rules"]
        self.assertTrue(rules)
        self.assertTrue(all(row["status"] == "needs_review" for row in rules))

    def test_stanford_kazakhstan_qualification_stays_source_bound_and_unassessed(self) -> None:
        resolved = admissions_catalog.resolve_context(
            "stanford-university-usa-ca",
            context={
                "study_option_id": "stanford-option-cs-bs",
                "application_route_id": "undergraduate-shared-evidence:stanford-first-year",
                "study_level": "undergraduate",
                "applicant_route": "international",
                "intended_entry_cycle": "Autumn 2027",
            },
        )
        fact = next(
            row for row in resolved["facts"]
            if row["id"] == "undergraduate-shared-evidence:stanford-kazakhstan-undergraduate-credential-equivalence"
        )
        self.assertEqual("conditional", fact["applicability"]["status"])
        self.assertEqual(
            [
                "undergraduate-shared-evidence:stanford-ug-international",
                "undergraduate-shared-evidence:stanford-ug-transfer-eligibility",
                "undergraduate-shared-evidence:stanford-ug-transfer-records",
            ],
            fact["source_ids"],
        )
        self.assertIn("No Stanford-owned public country-specific admissions equivalency table", fact["value"])
        self.assertFalse(any(key in fact for key in ("accepted", "not_accepted", "minimum")))
        sources = {row["id"]: row for row in resolved["sources"]}
        for source_id in fact["source_ids"]:
            host = urlparse(sources[source_id]["url"]).hostname or ""
            self.assertTrue(host == "stanford.edu" or host.endswith(".stanford.edu"), sources[source_id]["url"])


if __name__ == "__main__":
    unittest.main()

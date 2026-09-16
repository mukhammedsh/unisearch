import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend" / "scripts"))

from apply_official_facts import apply_official_facts  # noqa: E402


class OfficialFactsSyncTests(unittest.TestCase):
    maxDiff = None

    def _load_catalog(self):
        import json

        return json.loads((ROOT / "backend" / "data" / "official_facts.json").read_text(encoding="utf-8"))

    def _load_universities(self):
        import json

        return json.loads((ROOT / "backend" / "data" / "universities.json").read_text(encoding="utf-8"))

    def _topic_urls(self, row, topic):
        urls = []
        for item in row.get("verified_sources") or []:
            if not isinstance(item, dict):
                continue
            if str(item.get("topic") or "").strip().lower() != topic.lower():
                continue
            urls.append(str(item.get("url") or "").strip())
        return urls

    def test_apply_official_facts_is_idempotent(self):
        universities = [
            {
                "id": "demo",
                "description": "",
                "description_source": "https://example.edu/about",
                "tags": [],
                "verified_sources": [
                    {"topic": "student_count", "url": "https://example.edu/old-stats"},
                    {"topic": "obsolete_topic", "url": "https://example.edu/old-topic"},
                ],
            }
        ]
        catalog = {
            "universities": {
                "demo": {
                    "student_count": {
                        "value": 12345,
                        "source": "Example official facts",
                        "source_url": "https://example.edu/stats",
                        "verified_at": "2026-03-25",
                        "status": "official",
                        "confidence": "high",
                        "method": "Direct official figure.",
                    },
                    "acceptance_rate_percent": {
                        "value": 8.4,
                        "source": "Example admissions",
                        "source_url": "https://example.edu/admissions",
                        "verified_at": "2026-03-25",
                        "status": "official",
                        "confidence": "high",
                        "method": "Calculated from official counts.",
                        "basis": {
                            "applicants": 1000,
                            "admitted": 84,
                        },
                    },
                    "description": {
                        "value": "Example University is an official demo institution for synchronization tests.",
                        "source": "Example about",
                        "source_url": "https://example.edu/about",
                        "verified_at": "2026-03-25",
                        "status": "official",
                        "confidence": "high",
                        "method": "Direct official description.",
                    },
                    "tags": {
                        "value": ["research", "engineering"],
                        "source": "Example schools",
                        "source_url": "https://example.edu/schools",
                        "verified_at": "2026-03-25",
                        "status": "official_derived",
                        "confidence": "medium",
                        "method": "Derived from official schools structure.",
                    },
                    "verified_sources": [
                        {"topic": "programs", "url": "https://example.edu/programs"},
                        {"topic": "formats", "url": "https://example.edu/programs"},
                    ],
                    "clear_verified_topics": ["obsolete_topic"],
                }
            }
        }

        first = apply_official_facts(universities, catalog, verified_at="2026-03-25")
        second = apply_official_facts(universities, catalog, verified_at="2026-03-25")

        self.assertEqual(1, first)
        self.assertEqual(0, second)

        row = universities[0]
        self.assertEqual(12345, row.get("student_count"))
        self.assertEqual(
            "Example University is an official demo institution for synchronization tests.",
            row.get("description"),
        )
        self.assertEqual("https://example.edu/about", row.get("description_source"))
        self.assertEqual(["research", "engineering"], row.get("tags"))
        self.assertEqual(["https://example.edu/stats"], self._topic_urls(row, "student_count"))
        self.assertEqual(["https://example.edu/admissions"], self._topic_urls(row, "acceptance_rate"))
        self.assertEqual(["https://example.edu/about"], self._topic_urls(row, "description"))
        self.assertEqual(["https://example.edu/schools"], self._topic_urls(row, "tags"))
        self.assertEqual(["https://example.edu/programs"], self._topic_urls(row, "programs"))
        self.assertEqual(["https://example.edu/programs"], self._topic_urls(row, "formats"))
        self.assertEqual([], self._topic_urls(row, "obsolete_topic"))

    def test_catalog_and_dataset_stay_in_sync(self):
        catalog = self._load_catalog()
        universities = self._load_universities()
        by_id = {str(row.get("id") or "").strip(): row for row in universities}

        for uid, payload in (catalog.get("universities") or {}).items():
            self.assertIn(uid, by_id, uid)
            row = by_id[uid]
            facts = ((row.get("fact_provenance") or {}).get("facts") or {})
            academics = row.get("academics") or {}

            student_payload = payload.get("student_count")
            if isinstance(student_payload, dict):
                expected_value = int(round(float(student_payload["value"])))
                self.assertEqual(expected_value, row.get("student_count"), uid)
                self.assertEqual(expected_value, int(round(float((facts.get("student_count") or {}).get("value")))), uid)
                self.assertEqual(student_payload.get("source"), (facts.get("student_count") or {}).get("source"), uid)
                self.assertEqual(student_payload.get("source_url"), (facts.get("student_count") or {}).get("source_url"), uid)
                self.assertEqual(student_payload.get("verified_at"), (facts.get("student_count") or {}).get("verified_at"), uid)
                self.assertEqual(student_payload.get("status"), (facts.get("student_count") or {}).get("status"), uid)
                self.assertEqual(student_payload.get("confidence"), (facts.get("student_count") or {}).get("confidence"), uid)
                self.assertEqual(student_payload.get("method"), (facts.get("student_count") or {}).get("method"), uid)
                self.assertEqual(student_payload.get("basis"), (facts.get("student_count") or {}).get("basis"), uid)

            acceptance_payload = payload.get("acceptance_rate_percent")
            if isinstance(acceptance_payload, dict):
                expected_rate = round(float(acceptance_payload["value"]), 2)
                self.assertEqual(expected_rate, academics.get("acceptance_rate_percent"), uid)
                self.assertEqual(expected_rate, round(float((facts.get("acceptance_rate_percent") or {}).get("value")), 2), uid)
                meta = academics.get("acceptance_rate_percent_meta") or {}
                self.assertEqual(acceptance_payload.get("source"), meta.get("source"), uid)
                self.assertEqual(acceptance_payload.get("source_url"), meta.get("source_url"), uid)
                self.assertEqual(acceptance_payload.get("verified_at"), meta.get("verified_at"), uid)
                self.assertEqual(acceptance_payload.get("status"), meta.get("status"), uid)
                self.assertEqual(acceptance_payload.get("confidence"), meta.get("confidence"), uid)
                self.assertEqual(acceptance_payload.get("method"), meta.get("method"), uid)
                self.assertEqual(acceptance_payload.get("basis"), meta.get("basis"), uid)

            early_salary_payload = payload.get("early_career_salary")
            if isinstance(early_salary_payload, dict):
                expected_salary = round(float(early_salary_payload["value"]), 2)
                outcomes = row.get("outcomes") or {}
                self.assertEqual(expected_salary, outcomes.get("early_career_salary_usd"), uid)
                self.assertEqual(expected_salary, round(float((facts.get("early_career_salary") or {}).get("value")), 2), uid)
                self.assertEqual(early_salary_payload.get("source"), (facts.get("early_career_salary") or {}).get("source"), uid)
                self.assertEqual(early_salary_payload.get("source_url"), (facts.get("early_career_salary") or {}).get("source_url"), uid)
                self.assertEqual(early_salary_payload.get("verified_at"), (facts.get("early_career_salary") or {}).get("verified_at"), uid)
                if early_salary_payload.get("basis") is not None:
                    self.assertEqual(early_salary_payload.get("basis"), (facts.get("early_career_salary") or {}).get("basis"), uid)

            median_10yr_payload = payload.get("median_earnings_10yr")
            if isinstance(median_10yr_payload, dict):
                expected_median = round(float(median_10yr_payload["value"]), 2)
                outcomes = row.get("outcomes") or {}
                self.assertEqual(expected_median, outcomes.get("median_earnings_10yr_usd"), uid)
                if not isinstance(payload.get("early_career_salary"), dict):
                    self.assertNotIn("early_career_salary_usd", outcomes, f"{uid} must not have early_career_salary_usd when only median_earnings_10yr is cataloged")
                self.assertEqual(expected_median, round(float((facts.get("median_earnings_10yr") or {}).get("value")), 2), uid)
                self.assertEqual(median_10yr_payload.get("source"), (facts.get("median_earnings_10yr") or {}).get("source"), uid)
                self.assertEqual(median_10yr_payload.get("source_url"), (facts.get("median_earnings_10yr") or {}).get("source_url"), uid)
                self.assertEqual(median_10yr_payload.get("verified_at"), (facts.get("median_earnings_10yr") or {}).get("verified_at"), uid)

            salary_major_payload = payload.get("salary_by_major")
            if isinstance(salary_major_payload, dict):
                expected_dict = {str(k): round(float(v), 2) for k, v in salary_major_payload["value"].items()}
                outcomes = row.get("outcomes") or {}
                self.assertEqual(expected_dict, outcomes.get("salary_by_major"), uid)
                self.assertEqual(expected_dict, (facts.get("salary_by_major") or {}).get("value"), uid)

            description_payload = payload.get("description")
            if isinstance(description_payload, dict):
                self.assertEqual(description_payload.get("value"), row.get("description"), uid)
                self.assertEqual(description_payload.get("source_url"), row.get("description_source"), uid)
                self.assertEqual([description_payload.get("source_url")], self._topic_urls(row, "description"), uid)

            tags_payload = payload.get("tags")
            if isinstance(tags_payload, dict):
                self.assertEqual(tags_payload.get("value"), row.get("tags"), uid)
                self.assertEqual([tags_payload.get("source_url")], self._topic_urls(row, "tags"), uid)

            for topic in payload.get("clear_verified_topics") or []:
                self.assertEqual([], self._topic_urls(row, str(topic)), uid)

            if isinstance(payload.get("verified_sources"), list):
                expected_by_topic = {}
                for item in payload["verified_sources"]:
                    if not isinstance(item, dict):
                        continue
                    topic = str(item.get("topic") or "").strip()
                    url = str(item.get("url") or "").strip()
                    if not topic or not url:
                        continue
                    expected_by_topic.setdefault(topic, []).append(url)
                for topic, urls in expected_by_topic.items():
                    self.assertEqual(urls, self._topic_urls(row, topic), uid)

    def test_every_dataset_acceptance_rate_is_catalog_backed_with_full_provenance(self):
        catalog = self._load_catalog()
        universities = self._load_universities()
        catalog_rows = (catalog.get("universities") or {})

        for row in universities:
            uid = str(row.get("id") or "").strip()
            academics = row.get("academics") or {}
            if academics.get("acceptance_rate_percent") is None:
                continue

            self.assertIn(uid, catalog_rows, uid)
            payload = (catalog_rows.get(uid) or {}).get("acceptance_rate_percent")
            self.assertIsInstance(payload, dict, uid)

            expected_rate = round(float(payload.get("value")), 2)
            self.assertEqual(expected_rate, round(float(academics.get("acceptance_rate_percent")), 2), uid)

            meta = academics.get("acceptance_rate_percent_meta")
            self.assertIsInstance(meta, dict, uid)

            facts = ((row.get("fact_provenance") or {}).get("facts") or {})
            fact = facts.get("acceptance_rate_percent")
            self.assertIsInstance(fact, dict, uid)

            for field in ("source", "source_url", "verified_at", "status", "confidence", "method"):
                self.assertTrue(meta.get(field), f"{uid}:{field}")
                self.assertEqual(payload.get(field), meta.get(field), uid)
                self.assertEqual(payload.get(field), fact.get(field), uid)

            if payload.get("basis") is not None:
                self.assertEqual(payload.get("basis"), meta.get("basis"), uid)
                self.assertEqual(payload.get("basis"), fact.get("basis"), uid)

            self.assertEqual(expected_rate, round(float(fact.get("value")), 2), uid)
            self.assertEqual([payload.get("source_url")], self._topic_urls(row, "acceptance_rate"), uid)

    def test_every_dataset_outcome_salary_is_catalog_backed_with_full_provenance(self):
        catalog = self._load_catalog()
        universities = self._load_universities()
        catalog_rows = (catalog.get("universities") or {})

        for row in universities:
            uid = str(row.get("id") or "").strip()
            outcomes = row.get("outcomes") or {}
            facts = ((row.get("fact_provenance") or {}).get("facts") or {})

            if "early_career_salary_usd" in outcomes:
                self.assertIn(uid, catalog_rows, uid)
                payload = catalog_rows[uid].get("early_career_salary")
                self.assertIsInstance(payload, dict, uid)
                expected_val = round(float(payload["value"]), 2)
                self.assertEqual(expected_val, outcomes["early_career_salary_usd"], uid)
                self.assertEqual(expected_val, round(float(facts["early_career_salary"]["value"]), 2), uid)
                self.assertTrue(facts["early_career_salary"].get("source"), uid)
                self.assertTrue(facts["early_career_salary"].get("verified_at"), uid)

            if "median_earnings_10yr_usd" in outcomes:
                self.assertIn(uid, catalog_rows, uid)
                payload = catalog_rows[uid].get("median_earnings_10yr")
                self.assertIsInstance(payload, dict, uid)
                expected_val = round(float(payload["value"]), 2)
                self.assertEqual(expected_val, outcomes["median_earnings_10yr_usd"], uid)
                self.assertEqual(expected_val, round(float(facts["median_earnings_10yr"]["value"]), 2), uid)
                self.assertTrue(facts["median_earnings_10yr"].get("source"), uid)
                self.assertTrue(facts["median_earnings_10yr"].get("verified_at"), uid)

            if "salary_by_major" in outcomes:
                self.assertIn(uid, catalog_rows, uid)
                payload = catalog_rows[uid].get("salary_by_major")
                self.assertIsInstance(payload, dict, uid)
                self.assertEqual(payload["value"], outcomes["salary_by_major"], uid)
                self.assertEqual(payload["value"], facts["salary_by_major"]["value"], uid)
                self.assertTrue(facts["salary_by_major"].get("source"), uid)
                self.assertTrue(facts["salary_by_major"].get("verified_at"), uid)

    def test_no_deprecated_salary_keys_exist_or_get_reintroduced(self):
        catalog = self._load_catalog()
        universities = self._load_universities()

        # 1. Dataset must not contain deprecated fields
        for row in universities:
            uid = str(row.get("id") or "").strip()
            outcomes = row.get("outcomes") or {}
            facts = ((row.get("fact_provenance") or {}).get("facts") or {})
            self.assertNotIn("average_early_career_salary_usd", outcomes, uid)
            self.assertNotIn("average_salary_by_major", outcomes, uid)
            self.assertNotIn("average_salary_by_program", outcomes, uid)
            self.assertNotIn("average_early_career_salary_by_major_usd", outcomes, uid)
            self.assertNotIn("average_early_career_salary", facts, uid)
            self.assertNotIn("average_early_career_salary_usd", facts, uid)

        # 2. Re-running apply_official_facts must NOT reintroduce deprecated fields
        import copy
        copied_unis = copy.deepcopy(universities)
        changed = apply_official_facts(copied_unis, catalog, verified_at="2026-03-31")
        self.assertEqual(0, changed)

        for row in copied_unis:
            uid = str(row.get("id") or "").strip()
            outcomes = row.get("outcomes") or {}
            facts = ((row.get("fact_provenance") or {}).get("facts") or {})
            self.assertNotIn("average_early_career_salary_usd", outcomes, uid)
            self.assertNotIn("average_early_career_salary", facts, uid)

    def test_audit_outcomes_missing_early_salary_reports_error_without_nameerror(self):
        from audit_universities_data import _audit_outcomes_and_salary_provenance

        errors = []
        warnings = []
        outcomes = {}
        facts = {
            "early_career_salary": {
                "value": 75000.0,
                "unit": "usd_per_year",
                "source": "Sample Survey",
                "source_url": "https://example.edu/outcomes",
                "verified_at": "2026-03-31",
                "status": "official",
                "confidence": "high",
            }
        }
        _audit_outcomes_and_salary_provenance(errors, warnings, "test-uni", outcomes, facts)
        self.assertTrue(
            any("fact_provenance.facts has early_career_salary but outcomes is missing early_career_salary_usd" in err for err in errors),
            f"Expected early_career_salary missing error, got: {errors}",
        )

    def test_apply_official_facts_preserves_both_early_salary_and_median_10yr(self):
        sample_uni = [
            {
                "id": "dual-metrics-uni",
                "description": "Institution with both survey salary and scorecard median earnings.",
                "description_source": "https://example.edu/about",
                "tags": [],
                "verified_sources": [],
                "outcomes": {},
                "fact_provenance": {"schema_version": 1, "facts": {}},
            }
        ]
        catalog = {
            "universities": {
                "dual-metrics-uni": {
                    "early_career_salary": {
                        "value": 85000.0,
                        "unit": "usd_per_year",
                        "source": "Institutional Survey 2024",
                        "source_url": "https://example.edu/survey",
                        "verified_at": "2026-03-31",
                        "status": "official",
                        "confidence": "high",
                        "method": "Direct bachelor survey.",
                    },
                    "median_earnings_10yr": {
                        "value": 92000.0,
                        "unit": "usd_per_year",
                        "source": "U.S. Department of Education College Scorecard",
                        "source_url": "https://collegescorecard.ed.gov/",
                        "verified_at": "2026-09-17",
                        "status": "official_external",
                        "confidence": "high",
                        "method": "10-year post-entry median earnings from College Scorecard.",
                    },
                }
            }
        }

        apply_official_facts(sample_uni, catalog, verified_at="2026-09-17")

        row = sample_uni[0]
        outcomes = row.get("outcomes") or {}
        facts = (row.get("fact_provenance") or {}).get("facts") or {}

        self.assertEqual(85000.0, outcomes.get("early_career_salary_usd"))
        self.assertEqual(92000.0, outcomes.get("median_earnings_10yr_usd"))
        self.assertIn("early_career_salary", facts)
        self.assertIn("median_earnings_10yr", facts)
        self.assertEqual(85000.0, facts["early_career_salary"]["value"])
        self.assertEqual(92000.0, facts["median_earnings_10yr"]["value"])

    def test_audit_derived_salary_missing_fx_rate_fails(self):
        from audit_universities_data import _audit_derived_salary_basis

        errors = []
        fact = {
            "value": 60000.0,
            "unit": "usd_per_year",
            "source": "Foreign Uni Report",
            "verified_at": "2026-03-31",
            "status": "official_derived",
            "basis": {
                "fx_source": "ECB reference rates",
                "fx_date": "2026-03-30",
                "source_salary_eur": 55000,
            },
        }
        _audit_derived_salary_basis("early_career_salary", fact, "foreign-uni", errors)
        self.assertTrue(
            any("missing valid positive fx_rate" in err for err in errors),
            f"Expected missing fx_rate error, got: {errors}",
        )

        errors_missing_meta = []
        fact_missing_meta = {
            "status": "official_derived",
            "basis": {
                "usd_per_eur": 1.10,
                "source_salary_eur": 55000,
            },
        }
        _audit_derived_salary_basis("early_career_salary", fact_missing_meta, "foreign-uni", errors_missing_meta)
        self.assertTrue(
            any("fx_source is empty" in err for err in errors_missing_meta),
            f"Expected fx_source error, got: {errors_missing_meta}",
        )
        self.assertTrue(
            any("fx_date is empty" in err for err in errors_missing_meta),
            f"Expected fx_date error, got: {errors_missing_meta}",
        )

    def test_audit_salary_handles_invalid_types_nan_inf_strings_without_crash(self):
        from audit_universities_data import _audit_outcomes_and_salary_provenance
        import math

        invalid_values = [
            float("nan"),
            float("inf"),
            float("-inf"),
            "100000",
            None,
            True,
            False,
            -50000,
            0,
            [],
            {},
        ]

        for inv in invalid_values:
            errors = []
            warnings = []
            outcomes = {
                "early_career_salary_usd": inv,
                "median_earnings_10yr_usd": inv,
            }
            facts = {
                "early_career_salary": {
                    "value": inv,
                    "source": "Survey",
                    "verified_at": "2026-03-31",
                    "status": "official",
                },
                "median_earnings_10yr": {
                    "value": inv,
                    "source": "Scorecard",
                    "verified_at": "2026-09-17",
                    "status": "official_external",
                },
            }
            # Must run safely without raising TypeError, ValueError, OverflowError, NameError
            _audit_outcomes_and_salary_provenance(errors, warnings, "fuzz-uni", outcomes, facts)
            self.assertTrue(len(errors) > 0, f"Expected validation errors for {inv}, got none")

    def test_audit_allows_independent_metrics_with_identical_numeric_values(self):
        from audit_universities_data import _audit_outcomes_and_salary_provenance

        errors = []
        warnings = []
        # Both survey early salary and Scorecard median happened to be exactly 85000.0
        outcomes = {
            "early_career_salary_usd": 85000.0,
            "median_earnings_10yr_usd": 85000.0,
        }
        facts = {
            "early_career_salary": {
                "value": 85000.0,
                "source": "University Graduating Survey 2024",
                "source_url": "https://example.edu/survey",
                "verified_at": "2026-03-31",
                "status": "official",
            },
            "median_earnings_10yr": {
                "value": 85000.0,
                "source": "U.S. Dept of Ed College Scorecard",
                "source_url": "https://collegescorecard.ed.gov/",
                "verified_at": "2026-09-17",
                "status": "official_external",
            },
        }
        _audit_outcomes_and_salary_provenance(errors, warnings, "coincident-uni", outcomes, facts)
        self.assertEqual([], errors, f"Coinciding numeric values between distinct facts must be allowed, got errors: {errors}")


if __name__ == "__main__":
    unittest.main()

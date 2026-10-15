import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts import audit_universities_data
from scripts.audit_universities_data import _iter_source_urls


class AuditSourceCollectionTests(unittest.TestCase):
    def test_http_audit_finds_sources_through_supported_dataset_scopes(self):
        def source(name):
            return f"https://university.example/{name}"

        university = {
            "website": source("home"),
            "description_source": source("description"),
            "verified_sources": [
                {"topic": "verified", "url": source("verified")},
                None,
                {"topic": "empty", "url": ""},
            ],
            "academics": {
                "undergraduate_structure": {"source_url": source("structure")},
                "admissions": {
                    "university_wide": {
                        "provenance": {"source_url": source("university-wide")},
                        "sources": [{"url": source("university-wide-source")}, None],
                    },
                    "program_level": {
                        "provenance": {"source_url": source("program-level")},
                        "sources": [{"url": source("program-level-source")}],
                    },
                    "programs": [
                        {
                            "name": "Computer Science",
                            "provenance": {"source_url": source("program")},
                            "sources": [{"url": source("program-source")}],
                        },
                        None,
                    ],
                },
            },
            "finance": {
                "source_url": source("finance"),
                "one_time_costs": [{"source_urls": [source("setup"), "", None]}, None],
                "financial_aid": {"source_url": source("financial-aid")},
            },
            "admission_categories": [
                {
                    "id": "engineering",
                    "published_admission": {"source_url": source("category-admission")},
                    "finance_override": {"source_url": source("category-finance")},
                    "requirement_profiles": [
                        {
                            "id": "direct",
                            "published_admission": {"source_url": source("profile-admission")},
                            "finance_override": {"source_url": source("profile-finance")},
                            "stats_avg_source_url": source("profile-statistics"),
                            "language_requirements": [
                                {"code": "en", "stats_avg_source_url": source("language-statistics")},
                                None,
                            ],
                            "funding_options": [
                                {"id": "direct-award", "stats_avg_source_url": source("direct-award")},
                                None,
                            ],
                        },
                        None,
                        {"id": "inherited-funding"},
                    ],
                    "funding_options": [
                        {"id": "category-award", "stats_avg_source_url": source("category-award")}
                    ],
                },
                None,
            ],
            "fact_provenance": {
                "facts": {
                    "rank": {"source": source("rank-source"), "source_url": source("rank-url")},
                    "description": {"source": "Official university handbook", "source_url": "invalid"},
                    "ignored": None,
                }
            },
        }

        actual = list(_iter_source_urls(university))
        actual_keys = [key for key, _ in actual]
        expected_keys = [
            "website",
            "description_source",
            "verified_sources[0]/verified",
            "academics.undergraduate_structure.source_url",
            "academics.admissions.university_wide.provenance.source_url",
            "academics.admissions.university_wide.sources[0]",
            "academics.admissions.program_level.provenance.source_url",
            "academics.admissions.program_level.sources[0]",
            "academics.admissions.programs[0]/Computer Science/provenance.source_url",
            "academics.admissions.programs[0]/Computer Science/sources[0]",
            "finance.source_url",
            "finance.one_time_costs[0].source_urls[0]",
            "finance.financial_aid.source_url",
            "admission_categories[0]/engineering/published_admission.source_url",
            "admission_categories[0]/engineering/finance_override.source_url",
            "admission_categories[0]/engineering/requirement_profiles[0]/direct/published_admission.source_url",
            "admission_categories[0]/engineering/requirement_profiles[0]/direct/finance_override.source_url",
            "admission_categories[0]/engineering/requirement_profiles[0]/direct/stats_avg_source_url",
            "admission_categories[0]/engineering/requirement_profiles[0]/direct/language_requirements[0]/en/stats_avg_source_url",
            "admission_categories[0]/engineering/requirement_profiles[0]/direct/funding_options[0]/direct-award/stats_avg_source_url",
            "admission_categories[0]/engineering/requirement_profiles[2]/inherited-funding/funding_options[0]/category-award/stats_avg_source_url",
            "fact_provenance.facts.rank.source",
            "fact_provenance.facts.rank.source_url",
        ]

        self.assertEqual(expected_keys[:2], actual_keys[:2])
        self.assertCountEqual(expected_keys, actual_keys)
        self.assertTrue(all(url == source(url.rsplit("/", 1)[-1]) for _, url in actual))

    def test_dataset_audit_reports_unreadable_empty_and_invalid_root_inputs(self):
        with tempfile.TemporaryDirectory() as directory:
            data_path = Path(directory) / "universities.json"
            cases = [
                ("{", "Failed to read dataset:"),
                ("{}", "Dataset root must be a JSON list"),
                ("[]", "Dataset is empty"),
            ]
            for content, expected in cases:
                with self.subTest(content=content):
                    data_path.write_text(content, encoding="utf-8")
                    errors, warnings = audit_universities_data.audit_dataset(data_path)
                    self.assertTrue(any(error.startswith(expected) for error in errors))
                    self.assertEqual([], warnings)

            data_path.write_text("[null]", encoding="utf-8")
            errors, _ = audit_universities_data.audit_dataset(data_path)
            self.assertIn("Row 0 is not an object", errors)

    def test_http_audit_classifies_responses_and_obeys_per_university_cap(self):
        source_urls = [
            "https://university.example/home",
            "https://university.example/description",
            "https://university.example/catalog",
            "https://university.example/requirements",
            "https://university.example/not-checked",
        ]
        university = {
            "id": "http-audit-test",
            "website": source_urls[0],
            "description_source": source_urls[1],
            "verified_sources": [
                {"topic": "catalog", "url": source_urls[2]},
                {"topic": "requirements", "url": source_urls[3]},
                {"topic": "later", "url": source_urls[4]},
            ],
        }
        visited = []
        responses = [(404, source_urls[0]), (None, source_urls[1]), (500, source_urls[2]), (403, source_urls[3])]

        def fake_http_status(url, timeout_sec):
            visited.append(url)
            return responses[len(visited) - 1]

        with tempfile.TemporaryDirectory() as directory:
            data_path = Path(directory) / "universities.json"
            data_path.write_text(json.dumps([university]), encoding="utf-8")
            with patch.object(audit_universities_data, "_public_http_url_reason", return_value=""), patch.object(
                audit_universities_data, "_http_status", side_effect=fake_http_status
            ), patch.object(audit_universities_data.time, "sleep"):
                errors, warnings = audit_universities_data.audit_dataset(
                    data_path,
                    check_http=True,
                    max_urls_per_university=4,
                )

        self.assertEqual(source_urls[:4], visited)
        self.assertTrue(any("404 in website" in error for error in errors))
        self.assertTrue(any("URL unreachable in description_source" in warning for warning in warnings))
        self.assertTrue(any("500 in verified_sources[0]/catalog" in warning for warning in warnings))
        self.assertTrue(any("403 in verified_sources[1]/requirements" in warning for warning in warnings))
        self.assertFalse(any("not-checked" in message for message in errors + warnings))


if __name__ == "__main__":
    unittest.main()

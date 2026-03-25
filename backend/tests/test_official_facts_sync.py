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


if __name__ == "__main__":
    unittest.main()

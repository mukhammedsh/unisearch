import json
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend" / "scripts"))

from apply_official_admissions import apply_official_admissions  # noqa: E402


class OfficialAdmissionsSyncTests(unittest.TestCase):
    maxDiff = None

    def _load_catalog(self):
        return json.loads((ROOT / "backend" / "data" / "official_admissions.json").read_text(encoding="utf-8"))

    def _load_universities(self):
        return json.loads((ROOT / "backend" / "data" / "universities.json").read_text(encoding="utf-8"))

    def test_apply_official_admissions_is_idempotent(self):
        universities = [{"id": "demo", "academics": {"majors": ["Demo"]}}]
        catalog = {
            "schema_version": 1,
            "verified_at": "2026-03-25",
            "universities": {
                "demo": {
                    "university_wide": {
                        "status": "official_rate",
                        "kind": "acceptance_rate_percent",
                        "acceptance_rate_percent": 12.5,
                        "counts": {"applicants": 1000, "admitted": 125},
                        "semantics": "Official demo ratio.",
                        "sources": [{"url": "https://example.edu/admissions", "label": "Demo admissions"}],
                        "provenance": {
                            "source": "Demo admissions",
                            "source_url": "https://example.edu/admissions",
                            "verified_at": "2026-03-25",
                            "status": "official",
                            "confidence": "high",
                            "method": "Calculated from official counts.",
                            "basis": {"applicants": 1000, "admitted": 125},
                        },
                    },
                    "program_level": {
                        "status": "no_official_source",
                        "kind": "undergraduate_programs",
                        "notes": "No program-level demo data.",
                        "sources": [{"url": "https://example.edu/programs", "label": "Demo programs"}],
                    },
                    "programs": [],
                }
            },
        }

        first = apply_official_admissions(universities, catalog)
        second = apply_official_admissions(universities, catalog)

        self.assertEqual(1, first)
        self.assertEqual(0, second)

        admissions = ((universities[0].get("academics") or {}).get("admissions") or {})
        self.assertEqual(1, admissions.get("schema_version"))
        self.assertEqual("2026-03-25", admissions.get("status_date"))
        self.assertEqual(12.5, admissions.get("university_wide", {}).get("acceptance_rate_percent"))
        self.assertEqual("no_official_source", admissions.get("program_level", {}).get("status"))
        self.assertEqual([], admissions.get("programs"))

    def test_catalog_and_dataset_stay_in_sync(self):
        catalog = self._load_catalog()
        universities = self._load_universities()
        by_id = {str(row.get("id") or "").strip(): row for row in universities}
        expected_date = str(catalog.get("verified_at") or catalog.get("status_date") or "").strip()

        for uid, payload in (catalog.get("universities") or {}).items():
            self.assertIn(uid, by_id, uid)
            admissions = (((by_id[uid].get("academics") or {}).get("admissions")) or {})
            self.assertEqual(int(catalog.get("schema_version") or 1), admissions.get("schema_version"), uid)
            self.assertEqual(expected_date, admissions.get("status_date"), uid)
            self.assertEqual(payload.get("university_wide"), admissions.get("university_wide"), uid)
            self.assertEqual(payload.get("program_level"), admissions.get("program_level"), uid)
            self.assertEqual(payload.get("programs") or [], admissions.get("programs") or [], uid)

    def test_nested_acceptance_rate_matches_flat_mirror_when_present(self):
        universities = self._load_universities()
        for row in universities:
            uid = str(row.get("id") or "").strip()
            academics = row.get("academics") or {}
            admissions = academics.get("admissions") or {}
            university_wide = admissions.get("university_wide") or {}
            nested_rate = university_wide.get("acceptance_rate_percent")
            flat_rate = academics.get("acceptance_rate_percent")
            if nested_rate is None:
                continue
            self.assertIsNotNone(flat_rate, uid)
            self.assertEqual(round(float(nested_rate), 2), round(float(flat_rate), 2), uid)


if __name__ == "__main__":
    unittest.main()

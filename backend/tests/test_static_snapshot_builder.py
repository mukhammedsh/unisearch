import json
import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT / "backend" / "scripts") not in sys.path:
    sys.path.insert(0, str(REPO_ROOT / "backend" / "scripts"))

import build_static_snapshot as builder  # noqa: E402
from app.services import admissions_catalog, universities  # noqa: E402


class StaticSnapshotBuilderTests(unittest.TestCase):
    def test_build_static_snapshot_matches_live_public_projections_without_profile_data(self):
        with tempfile.TemporaryDirectory() as tmp:
            out_dir = Path(tmp) / "snapshot"
            summary = builder.build_static_snapshot(out_dir, include_assets=False)
            manifest = json.loads((out_dir / "manifest.json").read_text(encoding="utf-8"))

            self.assertEqual(manifest["schema_version"], "static-snapshot-1.0")
            self.assertEqual(manifest["admissions_revision"], admissions_catalog.get_revision())
            self.assertEqual(set(manifest["reviewed_ids"]), admissions_catalog.INSTITUTION_IDS)
            self.assertFalse(manifest["assets_included"])
            self.assertGreater(summary["files"], 150)

            # Reference configs exist and are non-empty.
            locations = json.loads((out_dir / "locations.json").read_text(encoding="utf-8"))
            exams_cfg = json.loads((out_dir / "exams-config.json").read_text(encoding="utf-8"))
            langs_cfg = json.loads((out_dir / "languages-config.json").read_text(encoding="utf-8"))
            self.assertEqual(locations, universities.get_locations())
            self.assertIn("SAT", exams_cfg)
            self.assertTrue(langs_cfg.get("languages"))

            # Catalog cards match live GET /universities card projection for English.
            catalog_eng = json.loads((out_dir / "catalog" / "eng.json").read_text(encoding="utf-8"))
            live_cards = universities.list_universities(
                limit=200,
                response_mode="card",
                search_lang="eng",
                sort="name_asc",
            )["items"]
            snapshot_cards_by_id = {entry["card"]["id"]: entry for entry in catalog_eng["items"]}
            self.assertEqual(len(snapshot_cards_by_id), len(live_cards))
            for live_card in live_cards[:5]:
                self.assertEqual(snapshot_cards_by_id[live_card["id"]]["card"], live_card)

            # Reviewed entries include per-level costs and study-options files with major_tags.
            mit_entry = snapshot_cards_by_id["mit-usa-cambridge"]
            self.assertIn("undergraduate", mit_entry["costs_by_level"])
            mit_options = json.loads(
                (out_dir / "admissions" / "mit-usa-cambridge" / "study-options.json").read_text(encoding="utf-8")
            )
            self.assertGreater(mit_options["total"], 100)
            self.assertTrue(mit_options["shared_routes"])
            self.assertTrue(all("major_tags" in item for item in mit_options["items"]))
            self.assertTrue(all("fact_ids" not in item for item in mit_options["items"]))

            # Detail JSON matches live get_university_by_id.
            mit_detail = json.loads(
                (out_dir / "universities" / "eng" / "mit-usa-cambridge.json").read_text(encoding="utf-8")
            )
            self.assertEqual(
                mit_detail,
                universities.get_university_by_id("mit-usa-cambridge", search_lang="eng", localized=True),
            )

            # Translations exist for every supported language.
            for lang in ("eng", "rus", "kaz"):
                pack = json.loads((out_dir / "translations" / f"{lang}.json").read_text(encoding="utf-8"))
                self.assertEqual(pack["lang"], lang)
                self.assertIsInstance(pack["data"], dict)


if __name__ == "__main__":
    unittest.main()

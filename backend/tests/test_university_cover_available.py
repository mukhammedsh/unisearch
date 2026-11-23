import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from app.services import universities as uni_service
from app.services import university_covers

REAL_COVER = "mit-usa-cambridge"
MISSING_COVER = ("astana-medical-university-kaz-astana", "kimep-university-kaz-almaty")


class CoverAvailableTests(unittest.TestCase):
    def test_flag_requires_every_requested_size_and_format(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            for folder in university_covers._COVER_FOLDERS:
                (root / folder).mkdir()
            with patch.object(university_covers.paths, "UNIVERSITY_ASSETS_DIR", root):
                self.assertFalse(university_covers.cover_available("demo"))
                for folder in university_covers._COVER_FOLDERS:
                    for extension in university_covers._COVER_FORMATS:
                        (root / folder / f"demo.{extension}").write_bytes(b"x")
                self.assertTrue(university_covers.cover_available("demo"))
                (root / "thumbnails-small" / "demo.webp").unlink()
                self.assertFalse(university_covers.cover_available("demo"))

    def test_flag_rejects_path_like_identifiers(self):
        for value in ("", None, "../secret", "a/b", "a\\b"):
            self.assertFalse(university_covers.cover_available(value))

    def test_catalog_card_map_and_full_payloads_report_missing_covers(self):
        items = {row["id"]: row for row in uni_service.load_universities()}
        for uid in MISSING_COVER:
            self.assertIs(items[uid]["cover_available"], False)
            self.assertIs(uni_service.to_university_card(items[uid])["cover_available"], False)
        self.assertIs(items[REAL_COVER]["cover_available"], True)
        self.assertIs(uni_service.to_university_card(items[REAL_COVER])["cover_available"], True)
        self.assertIs(uni_service.to_university_map_point(items[REAL_COVER])["cover_available"], True)
        listing = uni_service.list_universities(response_mode="map", paginate=False)["items"]
        flags = {row["id"]: row["cover_available"] for row in listing}
        self.assertEqual({uid: False for uid in MISSING_COVER}, {uid: flags[uid] for uid in MISSING_COVER if uid in flags})

    def test_every_listed_cover_exists_for_every_flagged_university(self):
        root = university_covers.paths.UNIVERSITY_ASSETS_DIR
        for row in uni_service.load_universities():
            if row["cover_available"]:
                for folder in university_covers._COVER_FOLDERS:
                    self.assertTrue((root / folder / f"{row['id']}.webp").is_file(), row["id"])


if __name__ == "__main__":
    unittest.main()

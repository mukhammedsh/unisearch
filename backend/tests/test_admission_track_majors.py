import copy
import unittest

from app.services import universities as uni_service


class AdmissionTrackMajorsTests(unittest.TestCase):
    def test_normalize_schema_hides_foundation_only_track_from_bachelor_scope(self):
        row = {
            "id": "nu-demo",
            "name": "NU Demo",
            "academics": {
                "programs": [
                    {
                        "name": "Computer Science",
                        "study_levels": ["Bachelor"],
                        "study_mode": "On-campus",
                    },
                    {
                        "name": "Mechanical and Aerospace Engineering",
                        "study_levels": ["Bachelor"],
                        "study_mode": "On-campus",
                    },
                    {
                        "name": "Foundation Year",
                        "study_levels": ["Foundation"],
                        "study_mode": "On-campus",
                    },
                ]
            },
            "admission_tracks": [
                {"id": "direct", "label": "Direct Admission (SAT)"},
                {"id": "foundation", "label": "Foundation Year (NUET)"},
            ],
        }

        normalized = uni_service._normalize_university_schema(copy.deepcopy(row))
        tracks = {
            str(track.get("id")): track
            for track in (normalized.get("admission_tracks") or [])
            if isinstance(track, dict)
        }

        self.assertEqual(
            ["Computer Science", "Mechanical and Aerospace Engineering"],
            tracks["direct"].get("applicable_majors"),
        )
        self.assertNotIn("foundation", tracks)
        self.assertEqual(
            ["Computer Science", "Mechanical and Aerospace Engineering"],
            normalized.get("academics", {}).get("majors"),
        )
        self.assertEqual(["Bachelor"], normalized.get("academics", {}).get("study_levels"))
        self.assertEqual(
            ["Computer Science", "Mechanical and Aerospace Engineering"],
            [
                program.get("name")
                for program in (normalized.get("academics", {}).get("programs") or [])
                if isinstance(program, dict)
            ],
        )

    def test_explicit_track_majors_are_preserved(self):
        row = {
            "id": "explicit-demo",
            "name": "Explicit Demo",
            "academics": {
                "programs": [
                    {
                        "name": "Computer Science",
                        "study_levels": ["Bachelor"],
                        "study_mode": "On-campus",
                    }
                ]
            },
            "admission_tracks": [
                {
                    "id": "special",
                    "label": "Special Track",
                    "applicable_majors": ["Mechanical and Aerospace Engineering"],
                }
            ],
        }

        normalized = uni_service._normalize_university_schema(copy.deepcopy(row))
        track = (normalized.get("admission_tracks") or [])[0]
        self.assertEqual(
            ["Mechanical and Aerospace Engineering"],
            track.get("applicable_majors"),
        )

    def test_nu_dataset_contains_nuet_track_with_majors(self):
        university = uni_service.get_university_by_id("nazarbayev-university-kaz-astana")
        self.assertIsNotNone(university)

        tracks = {
            str(track.get("id")): track
            for track in (university.get("admission_tracks") or [])
            if isinstance(track, dict)
        }

        self.assertIn("nu_nuet_undergraduate", tracks)
        self.assertIn("nu_nuet_undergraduate-grant-state-grant", tracks)
        self.assertNotIn("nu_nuet", tracks)
        self.assertNotIn("nu_nuet-grant-state-grant", tracks)

        undergraduate_track = tracks["nu_nuet_undergraduate"]
        undergraduate_grant_track = tracks["nu_nuet_undergraduate-grant-state-grant"]

        self.assertEqual(120, int((undergraduate_track.get("requirements") or {}).get("NUET", 0)))
        self.assertEqual("paid", str(undergraduate_track.get("funding_type") or ""))
        self.assertEqual(120, int((undergraduate_grant_track.get("requirements") or {}).get("NUET", 0)))
        self.assertEqual("grant", str(undergraduate_grant_track.get("funding_type") or ""))
        self.assertTrue(bool(undergraduate_track.get("applicable_majors")))
        self.assertTrue(bool(undergraduate_grant_track.get("applicable_majors")))

        majors = university.get("academics", {}).get("majors") or []
        self.assertNotIn("Foundation Year", majors)

        admissions_program_rows = (
            (university.get("academics", {}).get("admissions") or {}).get("programs") or []
        )
        self.assertNotIn(
            "Foundation Year",
            [
                row.get("program_name")
                for row in admissions_program_rows
                if isinstance(row, dict)
            ],
        )

    def test_nu_nuet_track_label_localizes_to_russian(self):
        university = uni_service.get_university_by_id(
            "nazarbayev-university-kaz-astana",
            search_lang="rus",
            localized=True,
        )
        self.assertIsNotNone(university)

        labels = [
            str(track.get("label") or "")
            for track in (university.get("admission_tracks") or [])
            if isinstance(track, dict) and str(track.get("id") or "").startswith("nu_nuet_undergraduate")
        ]
        self.assertTrue(labels)
        self.assertTrue(any("NUET" in label for label in labels))
        self.assertNotIn("NUET Applicants", labels)
        self.assertNotIn("NUET Applicants - State Grant (Grant)", labels)

    def test_nu_nuet_track_description_localizes_to_russian(self):
        university = uni_service.get_university_by_id(
            "nazarbayev-university-kaz-astana",
            search_lang="rus",
            localized=True,
        )
        self.assertIsNotNone(university)

        descriptions = [
            str(track.get("description") or "")
            for track in (university.get("admission_tracks") or [])
            if isinstance(track, dict) and str(track.get("id") or "").startswith("nu_nuet_undergraduate")
        ]
        self.assertTrue(descriptions)
        self.assertTrue(any("NUET" in text and "NUFYP" in text for text in descriptions))
        self.assertFalse(
            any(
                text.startswith("NUET applicants compete in NU's combined NUFYP")
                for text in descriptions
            )
        )


if __name__ == "__main__":
    unittest.main()

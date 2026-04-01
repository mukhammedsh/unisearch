import copy
import unittest

from app.services import universities as uni_service


class FundingOptionsCompatibilityTests(unittest.TestCase):
    def test_normalize_schema_expands_funding_options_into_variant_tracks(self):
        row = {
            "id": "funding-options-demo",
            "name": "Funding Options Demo",
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
                    "id": "direct",
                    "label": "Direct Admission",
                    "description": "One shared route with two funding outcomes.",
                    "requirements": {"GPA": 80},
                    "study_mode": "On-campus",
                    "funding_options": [
                        {
                            "id": "direct",
                            "label": "Direct Admission",
                            "requirements": {"SAT": 1200},
                            "funding_type": "paid",
                            "track_badge": "Paid",
                        },
                        {
                            "id": "direct-grant-merit",
                            "label": "Direct Admission - Merit Grant",
                            "requirements": {"SAT": 1400},
                            "funding_type": "grant",
                            "track_badge": "Grant",
                        },
                    ],
                }
            ],
        }

        normalized = uni_service._normalize_university_schema(copy.deepcopy(row))
        tracks = {
            str(track.get("id")): track
            for track in (normalized.get("admission_tracks") or [])
            if isinstance(track, dict)
        }

        self.assertEqual({"direct", "direct-grant-merit"}, set(tracks.keys()))
        self.assertEqual("paid", str(tracks["direct"].get("funding_type") or ""))
        self.assertEqual("grant", str(tracks["direct-grant-merit"].get("funding_type") or ""))
        self.assertEqual(80, int((tracks["direct"].get("requirements") or {}).get("GPA", 0)))
        self.assertEqual(1200, int((tracks["direct"].get("requirements") or {}).get("SAT", 0)))
        self.assertEqual(80, int((tracks["direct-grant-merit"].get("requirements") or {}).get("GPA", 0)))
        self.assertEqual(1400, int((tracks["direct-grant-merit"].get("requirements") or {}).get("SAT", 0)))
        self.assertEqual(
            ["Computer Science"],
            tracks["direct"].get("applicable_majors"),
        )
        self.assertEqual(
            ["Computer Science"],
            tracks["direct-grant-merit"].get("applicable_majors"),
        )

    def test_real_dataset_exposes_flattened_nu_variants(self):
        university = uni_service.get_university_by_id("nazarbayev-university-kaz-astana")
        self.assertIsNotNone(university)

        tracks = {
            str(track.get("id")): track
            for track in (university.get("admission_tracks") or [])
            if isinstance(track, dict)
        }

        self.assertIn("nu_direct", tracks)
        self.assertIn("nu_direct-grant-abay-kunanbayev", tracks)
        self.assertIn("nu_nuet_undergraduate", tracks)
        self.assertIn("nu_nuet_undergraduate-grant-state-grant", tracks)
        self.assertEqual("paid", str(tracks["nu_direct"].get("funding_type") or ""))
        self.assertEqual("grant", str(tracks["nu_direct-grant-abay-kunanbayev"].get("funding_type") or ""))

if __name__ == "__main__":
    unittest.main()

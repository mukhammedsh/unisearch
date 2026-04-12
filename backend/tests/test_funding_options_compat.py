import copy
import unittest

from app.services import universities as uni_service


class FundingOptionsCompatibilityTests(unittest.TestCase):
    def test_normalize_schema_keeps_compact_track_with_funding_options(self):
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

        self.assertEqual({"direct"}, set(tracks.keys()))
        self.assertEqual(["Computer Science"], tracks["direct"].get("applicable_majors"))

        options = {
            str(option.get("id")): option
            for option in (tracks["direct"].get("funding_options") or [])
            if isinstance(option, dict)
        }
        self.assertEqual({"direct", "direct-grant-merit"}, set(options.keys()))
        self.assertEqual("paid", str(options["direct"].get("funding_type") or ""))
        self.assertEqual("grant", str(options["direct-grant-merit"].get("funding_type") or ""))
        self.assertEqual(1200, int((options["direct"].get("requirements") or {}).get("SAT", 0)))
        self.assertEqual(1400, int((options["direct-grant-merit"].get("requirements") or {}).get("SAT", 0)))
        self.assertEqual(["Computer Science"], options["direct"].get("applicable_majors"))
        self.assertEqual(["Computer Science"], options["direct-grant-merit"].get("applicable_majors"))

    def test_expand_admission_track_variants_supports_flattened_scoring_compat(self):
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
            for track in uni_service.expand_admission_track_variants(normalized.get("admission_tracks"))
            if isinstance(track, dict)
        }

        self.assertEqual({"direct", "direct-grant-merit"}, set(tracks.keys()))
        self.assertEqual("paid", str(tracks["direct"].get("funding_type") or ""))
        self.assertEqual("grant", str(tracks["direct-grant-merit"].get("funding_type") or ""))
        self.assertEqual(80, int((tracks["direct"].get("requirements") or {}).get("GPA", 0)))
        self.assertEqual(1200, int((tracks["direct"].get("requirements") or {}).get("SAT", 0)))
        self.assertEqual(80, int((tracks["direct-grant-merit"].get("requirements") or {}).get("GPA", 0)))
        self.assertEqual(1400, int((tracks["direct-grant-merit"].get("requirements") or {}).get("SAT", 0)))

    def test_real_dataset_exposes_compact_nu_tracks_with_funding_options(self):
        university = uni_service.get_university_by_id("nazarbayev-university-kaz-astana")
        self.assertIsNotNone(university)

        tracks = {
            str(track.get("id")): track
            for track in (university.get("admission_tracks") or [])
            if isinstance(track, dict)
        }

        self.assertIn("nu_sat_applicants", tracks)
        self.assertIn("nu_act_applicants", tracks)
        self.assertIn("nu_nuet_undergraduate", tracks)
        self.assertNotIn("nu_direct-grant-abay-kunanbayev", tracks)
        self.assertNotIn("nu_nuet_undergraduate-grant-state-grant", tracks)

        sat_options = {
            str(option.get("id")): option
            for option in (tracks["nu_sat_applicants"].get("funding_options") or [])
            if isinstance(option, dict)
        }
        act_options = {
            str(option.get("id")): option
            for option in (tracks["nu_act_applicants"].get("funding_options") or [])
            if isinstance(option, dict)
        }
        nuet_options = {
            str(option.get("id")): option
            for option in (tracks["nu_nuet_undergraduate"].get("funding_options") or [])
            if isinstance(option, dict)
        }

        self.assertIn("nu_sat_applicants", sat_options)
        self.assertIn("nu_sat_applicants-grant-abay-kunanbayev", sat_options)
        self.assertIn("nu_act_applicants", act_options)
        self.assertIn("nu_act_applicants-grant-abay-kunanbayev", act_options)
        self.assertIn("nu_nuet_undergraduate", nuet_options)
        self.assertIn("nu_nuet_undergraduate-grant-state-grant", nuet_options)
        self.assertEqual("paid", str(sat_options["nu_sat_applicants"].get("funding_type") or ""))
        self.assertEqual("grant", str(sat_options["nu_sat_applicants-grant-abay-kunanbayev"].get("funding_type") or ""))
        self.assertEqual(1240, int((sat_options["nu_sat_applicants"].get("requirements") or {}).get("SAT", 0)))
        self.assertEqual(26, int((act_options["nu_act_applicants"].get("requirements") or {}).get("ACT", 0)))
        self.assertEqual(1475, int((sat_options["nu_sat_applicants"].get("stats_avg") or {}).get("SAT", 0)))
        self.assertFalse(bool(act_options["nu_act_applicants"].get("stats_avg")))


if __name__ == "__main__":
    unittest.main()

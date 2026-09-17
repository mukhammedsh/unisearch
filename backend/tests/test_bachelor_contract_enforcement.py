import unittest
from fastapi.testclient import TestClient

from app.main import app


class BachelorContractEnforcementTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_universities_list_contains_only_bachelor_levels(self):
        """Verify that the /universities endpoint returns only bachelor's study programs."""
        response = self.client.get("/universities?limit=50")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        for item in data.get("items", []):
            programs = item.get("academics", {}).get("programs", [])
            for program in programs:
                levels = program.get("study_levels", [])
                for level in levels:
                    # Exclude master's, PhD, and MBA degrees
                    self.assertNotIn("Master", level)
                    self.assertNotIn("PhD", level)
                    self.assertNotIn("Doctorate", level)
                    self.assertNotIn("Graduate", level)
                    self.assertNotIn("MBA", level)

    def test_university_detail_contains_only_bachelor_exams_and_levels(self):
        """Verify that university detail endpoints do not contain graduate exams (GRE, GMAT, etc.)."""
        # First retrieve the list of all universities to test details for each
        list_response = self.client.get("/universities?limit=100")
        self.assertEqual(list_response.status_code, 200)
        list_data = list_response.json()
        
        forbidden_exams = {"GRE", "GMAT", "LSAT", "MCAT"}
        
        for uni in list_data.get("items", []):
            uni_id = uni.get("id")
            detail_response = self.client.get(f"/universities/{uni_id}")
            self.assertEqual(detail_response.status_code, 200)
            detail = detail_response.json()
            
            # 1. Check academic programs
            programs = detail.get("academics", {}).get("programs", [])
            for program in programs:
                levels = program.get("study_levels", [])
                for level in levels:
                    self.assertNotIn("Master", level)
                    self.assertNotIn("PhD", level)
                    self.assertNotIn("Doctorate", level)
                    self.assertNotIn("Graduate", level)
                    self.assertNotIn("MBA", level)
            
            # 2. Check exam requirements across admission categories
            categories = detail.get("admission_categories", [])
            for category in categories:
                # Check requirements in requirement profiles
                profiles = category.get("requirement_profiles", [])
                for profile in profiles:
                    reqs = profile.get("requirements", {})
                    for exam_key in reqs.keys():
                        self.assertNotIn(exam_key.upper(), forbidden_exams)
                        
                    stats = profile.get("stats_avg", {})
                    for exam_key in stats.keys():
                        self.assertNotIn(exam_key.upper(), forbidden_exams)
                        
                # Check requirements in funding options
                funding_options = category.get("funding_options", [])
                for funding in funding_options:
                    reqs = funding.get("requirements", {}) if funding else {}
                    if reqs:
                        for exam_key in reqs.keys():
                            self.assertNotIn(exam_key.upper(), forbidden_exams)


if __name__ == "__main__":
    unittest.main()

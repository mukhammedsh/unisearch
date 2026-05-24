import unittest
from fastapi.testclient import TestClient

from app.main import app


class BachelorContractEnforcementTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_universities_list_contains_only_bachelor_levels(self):
        """Проверяет, что эндпоинт списка вузов /universities возвращает только программы бакалавриата."""
        response = self.client.get("/universities?limit=50")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        for item in data.get("items", []):
            programs = item.get("academics", {}).get("programs", [])
            for program in programs:
                levels = program.get("study_levels", [])
                for level in levels:
                    # Исключаем магистратуру, PhD и MBA
                    self.assertNotIn("Master", level)
                    self.assertNotIn("PhD", level)
                    self.assertNotIn("Doctorate", level)
                    self.assertNotIn("Graduate", level)
                    self.assertNotIn("MBA", level)

    def test_university_detail_contains_only_bachelor_exams_and_levels(self):
        """Проверяет, что детальные эндпоинты вузов не содержат экзаменов магистратуры (GRE, GMAT и др.)."""
        # Сначала получаем список всех вузов, чтобы проверить детали каждого
        list_response = self.client.get("/universities?limit=100")
        self.assertEqual(list_response.status_code, 200)
        list_data = list_response.json()
        
        forbidden_exams = {"GRE", "GMAT", "LSAT", "MCAT"}
        
        for uni in list_data.get("items", []):
            uni_id = uni.get("id")
            detail_response = self.client.get(f"/universities/{uni_id}")
            self.assertEqual(detail_response.status_code, 200)
            detail = detail_response.json()
            
            # 1. Проверяем программы
            programs = detail.get("academics", {}).get("programs", [])
            for program in programs:
                levels = program.get("study_levels", [])
                for level in levels:
                    self.assertNotIn("Master", level)
                    self.assertNotIn("PhD", level)
                    self.assertNotIn("Doctorate", level)
                    self.assertNotIn("Graduate", level)
                    self.assertNotIn("MBA", level)
            
            # 2. Проверяем требования к экзаменам в категориях поступления
            categories = detail.get("admission_categories", [])
            for category in categories:
                # Проверяем требования в профилях
                profiles = category.get("requirement_profiles", [])
                for profile in profiles:
                    reqs = profile.get("requirements", {})
                    for exam_key in reqs.keys():
                        self.assertNotIn(exam_key.upper(), forbidden_exams)
                        
                    stats = profile.get("stats_avg", {})
                    for exam_key in stats.keys():
                        self.assertNotIn(exam_key.upper(), forbidden_exams)
                        
                # Проверяем требования в опциях финансирования
                funding_options = category.get("funding_options", [])
                for funding in funding_options:
                    reqs = funding.get("requirements", {}) if funding else {}
                    if reqs:
                        for exam_key in reqs.keys():
                            self.assertNotIn(exam_key.upper(), forbidden_exams)


if __name__ == "__main__":
    unittest.main()

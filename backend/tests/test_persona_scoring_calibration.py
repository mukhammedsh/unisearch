import unittest
from typing import Any, Dict

from app.services import universities as uni_service
from app.services.ai_scoring import estimate_uni_chance


class TestPersonaScoringCalibration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.mit = uni_service.get_university_by_id("mit-usa-cambridge")
        cls.tum = uni_service.get_university_by_id("technical-university-of-munich-de-munich")
        cls.nu = uni_service.get_university_by_id("nazarbayev-university-kaz-astana")

        # Проверим, что все эталонные вузы загрузились
        assert cls.mit is not None, "MIT university fixture not found!"
        assert cls.tum is not None, "TUM university fixture not found!"
        assert cls.nu is not None, "Nazarbayev University fixture not found!"

    def test_alexey_german_budget_persona(self):
        """
        Алексей: GPA 85, без SAT, IELTS 6.5, бюджет $10,000.
        Должен проходить в TUM (Германия) с средним шансом,
        но отсекаться в MIT и NU из-за отсутствия SAT.
        """
        profile = {
            "locale": "eng",
            "budget": 10000,
            "gpa": 85.0,
            "exams": [],
            "languages": [
                {"code": "en", "kind": "exam", "exam": "IELTS", "score": 6.5}
            ],
            "selectedAdmissionChoices": {}
        }

        # 1. MIT (требует SAT)
        res_mit = estimate_uni_chance(self.mit, profile)
        chance_mit = res_mit.get("overallChance")
        self.assertTrue(chance_mit is None or chance_mit == 0, f"Alexey in MIT should have 0% or None chance, got {chance_mit}%")

        # 2. TUM (проходит по порогам)
        res_tum = estimate_uni_chance(self.tum, profile)
        chance_tum = res_tum.get("overallChance")
        self.assertIsNotNone(chance_tum)
        self.assertTrue(50 <= chance_tum <= 75, f"Alexey in TUM should be in 50-75% range, got {chance_tum}%")

        # 3. NU (требует SAT)
        res_nu = estimate_uni_chance(self.nu, profile)
        chance_nu = res_nu.get("overallChance")
        self.assertTrue(chance_nu is None or chance_nu == 0, f"Alexey in NU should have 0% or None chance, got {chance_nu}%")

    def test_maria_top_ivy_persona(self):
        """
        Мария: GPA 98, SAT 1560, IELTS 8.0, бюджет $100,000.
        Должна иметь высокие шансы везде, но в MIT шанс должен быть реалистичным (не 100%)
        из-за жесткого общего конкурса (low acceptance rate).
        """
        profile = {
            "locale": "eng",
            "budget": 100000,
            "gpa": 98.0,
            "exams": [
                {"id": "SAT", "score": 1560}
            ],
            "languages": [
                {"code": "en", "kind": "exam", "exam": "IELTS", "score": 8.0}
            ],
            "selectedAdmissionChoices": {}
        }

        # 1. MIT
        res_mit = estimate_uni_chance(self.mit, profile)
        chance_mit = res_mit.get("overallChance")
        self.assertIsNotNone(chance_mit)
        self.assertTrue(40 <= chance_mit <= 65, f"Maria in MIT should be in 40-65% range, got {chance_mit}%")

        # 2. TUM
        res_tum = estimate_uni_chance(self.tum, profile)
        chance_tum = res_tum.get("overallChance")
        self.assertIsNotNone(chance_tum)
        self.assertTrue(chance_tum >= 85, f"Maria in TUM should have >=85% chance, got {chance_tum}%")

        # 3. NU
        res_nu = estimate_uni_chance(self.nu, profile)
        chance_nu = res_nu.get("overallChance")
        self.assertIsNotNone(chance_nu)
        self.assertTrue(55 <= chance_nu <= 80, f"Maria in NU should be in 55-80% range, got {chance_nu}%")

    def test_dias_average_kazakh_persona(self):
        """
        Диас: GPA 82, SAT 1350, IELTS 6.0, бюджет $15,000.
        Не проходит жесткие языковые и балльные пороги в MIT и TUM.
        В NU имеет крайне низкий (околонулевой) шанс.
        """
        profile = {
            "locale": "eng",
            "budget": 15000,
            "gpa": 82.0,
            "exams": [
                {"id": "SAT", "score": 1350}
            ],
            "languages": [
                {"code": "en", "kind": "exam", "exam": "IELTS", "score": 6.0}
            ],
            "selectedAdmissionChoices": {}
        }

        # 1. MIT
        res_mit = estimate_uni_chance(self.mit, profile)
        chance_mit = res_mit.get("overallChance")
        self.assertTrue(chance_mit is None or chance_mit == 0, f"Dias in MIT should have 0% or None chance, got {chance_mit}%")

        # 2. TUM
        res_tum = estimate_uni_chance(self.tum, profile)
        chance_tum = res_tum.get("overallChance")
        self.assertTrue(chance_tum is None or chance_tum == 0, f"Dias in TUM should have 0% or None chance, got {chance_tum}%")

        # 3. NU
        res_nu = estimate_uni_chance(self.nu, profile)
        chance_nu = res_nu.get("overallChance")
        self.assertIsNotNone(chance_nu)
        self.assertTrue(chance_nu <= 5, f"Dias in NU should have <=5% chance, got {chance_nu}%")

    def test_adil_zero_budget_genius(self):
        """
        Адиль: GPA 95, SAT 1550, IELTS 7.5, бюджет $0.
        Имеет высокие баллы, но нулевой бюджет.
        В MIT из-за Need-based Aid шанс сохраняется, но пенализируется (от 20% до 40%).
        В TUM и NU шанс также сохраняется за счет бесплатного обучения / грантов (от 45% до 90%).
        """
        profile = {
            "locale": "eng",
            "budget": 0,
            "gpa": 95.0,
            "exams": [
                {"id": "SAT", "score": 1550}
            ],
            "languages": [
                {"code": "en", "kind": "exam", "exam": "IELTS", "score": 7.5}
            ],
            "selectedAdmissionChoices": {}
        }

        # 1. MIT (бюджет $0 пенализирует шанс с ~53% до ~27%)
        res_mit = estimate_uni_chance(self.mit, profile)
        chance_mit = res_mit.get("overallChance")
        self.assertIsNotNone(chance_mit)
        self.assertTrue(20 <= chance_mit <= 40, f"Adil in MIT should be in 20-40% range, got {chance_mit}%")

        # 2. TUM
        res_tum = estimate_uni_chance(self.tum, profile)
        chance_tum = res_tum.get("overallChance")
        self.assertIsNotNone(chance_tum)
        self.assertTrue(75 <= chance_tum <= 90, f"Adil in TUM should be in 75-90% range, got {chance_tum}%")

        # 3. NU (грант Абая Кунанбаева позволяет учиться с бюджетом $0)
        res_nu = estimate_uni_chance(self.nu, profile)
        chance_nu = res_nu.get("overallChance")
        self.assertIsNotNone(chance_nu)
        self.assertTrue(45 <= chance_nu <= 70, f"Adil in NU should be in 45-70% range, got {chance_nu}%")

    def test_lisa_borderline_ielts(self):
        """
        Лиза: GPA 90, SAT 1480, IELTS 6.5, бюджет $50,000.
        Срезается в MIT (минимальный IELTS 7.5).
        Проходит в TUM (IELTS 6.5 >= 6.5) и в NU (IELTS 6.5 >= 6.5).
        """
        profile = {
            "locale": "eng",
            "budget": 50000,
            "gpa": 90.0,
            "exams": [
                {"id": "SAT", "score": 1480}
            ],
            "languages": [
                {"code": "en", "kind": "exam", "exam": "IELTS", "score": 6.5}
            ],
            "selectedAdmissionChoices": {}
        }

        # 1. MIT (срезается по IELTS)
        res_mit = estimate_uni_chance(self.mit, profile)
        chance_mit = res_mit.get("overallChance")
        self.assertTrue(chance_mit is None or chance_mit == 0, f"Lisa in MIT should have 0% or None chance, got {chance_mit}%")

        # 2. TUM
        res_tum = estimate_uni_chance(self.tum, profile)
        chance_tum = res_tum.get("overallChance")
        self.assertIsNotNone(chance_tum)
        self.assertTrue(60 <= chance_tum <= 80, f"Lisa in TUM should be in 60-80% range, got {chance_tum}%")

        # 3. NU
        res_nu = estimate_uni_chance(self.nu, profile)
        chance_nu = res_nu.get("overallChance")
        self.assertIsNotNone(chance_nu)
        self.assertTrue(35 <= chance_nu <= 55, f"Lisa in NU should be in 35-55% range, got {chance_nu}%")

    def test_anonymous_empty_profile(self):
        """
        Пустой профиль: GPA 0, нет экзаменов, нет языков, бюджет $0.
        Не должен приводить к падению бэкенда. Должен выдавать 0% или None.
        """
        profile = {
            "locale": "eng",
            "budget": 0,
            "gpa": 0,
            "exams": [],
            "languages": [],
            "selectedAdmissionChoices": {}
        }

        # 1. MIT
        res_mit = estimate_uni_chance(self.mit, profile)
        chance_mit = res_mit.get("overallChance")
        self.assertTrue(chance_mit is None or chance_mit == 0, f"Anonymous in MIT should have 0% or None chance, got {chance_mit}%")

        # 2. TUM
        res_tum = estimate_uni_chance(self.tum, profile)
        chance_tum = res_tum.get("overallChance")
        self.assertTrue(chance_tum is None or chance_tum == 0, f"Anonymous in TUM should have 0% or None chance, got {chance_tum}%")

        # 3. NU
        res_nu = estimate_uni_chance(self.nu, profile)
        chance_nu = res_nu.get("overallChance")
        self.assertTrue(chance_nu is None or chance_nu == 0, f"Anonymous in NU should have 0% or None chance, got {chance_nu}%")


if __name__ == "__main__":
    unittest.main()

import copy
import unittest

from app.services import exams as exams_service
from app.services import universities as uni_service
from app.services.ai_scoring import _admission_choice_key, estimate_uni_chance


_NUMERIC_EXAM_RANGES = {
    "GPA": (0, 100),
    "SAT": (400, 1600),
    "ACT": (1, 36),
    "UNT": (0, 140),
    "ENT": (0, 140),
    "NUET": (0, 240),
    "HKDSE_WEIGHTED_TOTAL": (0, 56),
    "IELTS": (0, 9),
    "TOEFL_IBT": (0, 120),
    "DUOLINGO": (10, 160),
    "PTE_ACADEMIC": (10, 90),
    "TESTDAF_TDN": (3, 5),
    "DSH_LEVEL": (1, 3),
    "A_LEVEL_CERT": (0, 18),
}


def _normalize_exam(exam_id, raw_score):
    try:
        return exams_service.normalize_exam_score(exam_id, raw_score)
    except Exception:
        return None


def _raw_score_for_normalized(exam_id, target_normalized):
    exam_key = str(exam_id or "").strip().upper()
    if not exam_key:
        return None

    low, high = _NUMERIC_EXAM_RANGES.get(exam_key, (0, 100))
    low = float(low)
    high = float(high)
    low_norm = _normalize_exam(exam_key, low)
    high_norm = _normalize_exam(exam_key, high)
    if low_norm is None or high_norm is None or abs(float(high_norm) - float(low_norm)) < 1e-9:
        return None

    for _ in range(40):
        mid = (low + high) / 2.0
        mid_norm = _normalize_exam(exam_key, mid)
        if mid_norm is None:
            return None
        if float(mid_norm) < float(target_normalized):
            low = mid
        else:
            high = mid

    raw_score = (low + high) / 2.0
    if exam_key in {
        "SAT",
        "ACT",
        "UNT",
        "ENT",
        "NUET",
        "TOEFL_IBT",
        "DUOLINGO",
        "HKDSE_WEIGHTED_TOTAL",
        "A_LEVEL_CERT",
    }:
        return int(round(raw_score))
    if exam_key in {"IELTS", "PTE_ACADEMIC"}:
        return round(raw_score * 2.0) / 2.0
    return round(raw_score, 2)


def _add_exam(profile, exam_id, score):
    exam_key = str(exam_id or "").strip().upper()
    if not exam_key or score is None:
        return
    if exam_key == "GPA":
        profile["gpa"] = max(float(profile.get("gpa") or 0.0), float(score))
    profile.setdefault("exams", []).append({"id": exam_key, "score": score})


def _language_rules(choice):
    raw = choice.get("language_requirements")
    if isinstance(raw, dict) and isinstance(raw.get("items"), list):
        return [row for row in raw.get("items", []) if isinstance(row, dict)]
    if isinstance(raw, dict):
        return [
            {"code": code, **cfg}
            for code, cfg in raw.items()
            if isinstance(cfg, dict)
        ]
    if isinstance(raw, list):
        return [row for row in raw if isinstance(row, dict)]
    return []


def _add_language(profile, rule):
    code = str(rule.get("code") or "en").strip().lower()
    if bool(rule.get("accept_native")):
        profile.setdefault("languages", []).append({"code": code, "kind": "native"})
        return

    req = rule.get("requirements") if isinstance(rule.get("requirements"), dict) else rule.get("exams")
    if isinstance(req, dict) and req:
        exam_id, min_score = next(iter(req.items()))
        avg = rule.get("stats_avg") if isinstance(rule.get("stats_avg"), dict) else {}
        score = max(float(min_score or 0.0), float(avg.get(exam_id) or min_score or 0.0))
        profile.setdefault("languages", []).append(
            {"code": code, "kind": "exam", "exam": str(exam_id).upper(), "score": score}
        )
        return

    cefr = max(
        float(rule.get("min_cefr") or 0.0),
        float(rule.get("recommended_cefr") or rule.get("avg_cefr") or rule.get("min_cefr") or 4.0),
    )
    profile.setdefault("languages", []).append({"code": code, "kind": "cefr", "cefr": cefr})


def _profile_for_choice_percentile(university, choice, choice_index, percentile_key):
    score_profile = choice.get("score_profile") if isinstance(choice.get("score_profile"), dict) else {}
    target = score_profile.get(percentile_key)
    if target is None:
        return None

    compatible_ids = score_profile.get("compatible_exam_ids")
    if not isinstance(compatible_ids, list):
        compatible_ids = [score_profile.get("exam_id")]
    primary_exam = next((str(exam_id or "").strip().upper() for exam_id in compatible_ids if str(exam_id or "").strip()), "")
    raw_score = _raw_score_for_normalized(primary_exam, float(target))
    if raw_score is None:
        return None

    profile = {
        "locale": "eng",
        "budget": 1_000_000,
        "selectedAdmissionChoices": {
            str(university.get("id") or ""): {
                "categoryId": str(choice.get("category_id") or "").strip(),
                "requirementProfileId": str(choice.get("requirement_profile_id") or "").strip(),
                "fundingOptionId": str(choice.get("funding_option_id") or "").strip(),
                "choiceKey": _admission_choice_key(choice, choice_index),
            },
        },
    }
    _add_exam(profile, primary_exam, raw_score)

    requirements = choice.get("requirements") if isinstance(choice.get("requirements"), dict) else {}
    averages = choice.get("stats_avg") if isinstance(choice.get("stats_avg"), dict) else {}
    for exam_id, min_score in requirements.items():
        exam_key = str(exam_id or "").strip().upper()
        if exam_key == primary_exam:
            _add_exam(profile, exam_key, max(float(raw_score), float(min_score or 0.0)))
        elif any(token in exam_key for token in ("IELTS", "TOEFL", "PTE", "DUOLINGO", "TESTDAF", "DSH")):
            continue
        else:
            _add_exam(profile, exam_key, max(float(min_score or 0.0), float(averages.get(exam_id) or min_score or 0.0)))

    for rule in _language_rules(choice):
        _add_language(profile, rule)
    return profile


def _single_choice_university(university, choice, keep_score_profile):
    out = copy.deepcopy(university)
    profile = {
        "id": choice.get("requirement_profile_id") or choice.get("id") or "profile",
        "label": choice.get("requirement_profile_label") or choice.get("label") or "Requirement profile",
        "requirements": copy.deepcopy(choice.get("requirements") if isinstance(choice.get("requirements"), dict) else {}),
        "stats_avg": copy.deepcopy(choice.get("stats_avg") if isinstance(choice.get("stats_avg"), dict) else {}),
    }
    for key in (
        "language_requirements",
        "language_requirements_mode",
        "extra_requirements",
        "scholarships",
        "applicable_majors",
        "scope",
    ):
        if key in choice:
            profile[key] = copy.deepcopy(choice.get(key))
    if keep_score_profile and isinstance(choice.get("score_profile"), dict):
        profile["score_profile"] = copy.deepcopy(choice.get("score_profile"))

    out["admission_categories"] = [
        {
            "id": choice.get("category_id") or "category",
            "label": choice.get("category_label") or "Admission category",
            "scope": choice.get("scope") or "general",
            "requirement_profiles": [profile],
        }
    ]
    return out


class UniChanceFallbackCalibrationTests(unittest.TestCase):
    def test_estimated_fallback_is_calibrated_against_score_profile_choices(self):
        comparisons = []

        for university in uni_service.list_universities(limit=10000).get("items", []):
            choices = uni_service.expand_admission_choices(university.get("admission_categories"))
            for choice_index, choice in enumerate(choices):
                if not isinstance(choice, dict) or not isinstance(choice.get("score_profile"), dict):
                    continue
                score_profile = choice["score_profile"]
                for label, key in (("p25", "p25_normalized"), ("median", "median_normalized"), ("p75", "p75_normalized")):
                    profile = _profile_for_choice_percentile(university, choice, choice_index, key)
                    if profile is None:
                        continue

                    exact = estimate_uni_chance(_single_choice_university(university, choice, True), profile)
                    fallback = estimate_uni_chance(_single_choice_university(university, choice, False), profile)
                    exact_chance = exact.get("overallChance")
                    fallback_chance = fallback.get("overallChance")
                    if exact_chance is None or fallback_chance is None:
                        continue

                    comparisons.append(
                        {
                            "university": university.get("id"),
                            "choice": _admission_choice_key(choice, choice_index),
                            "point": label,
                            "exam": str(score_profile.get("exam_id") or "").upper(),
                            "exact": int(exact_chance),
                            "fallback": int(fallback_chance),
                            "diff": int(fallback_chance) - int(exact_chance),
                        }
                    )

        self.assertGreaterEqual(len(comparisons), 30)
        absolute_diffs = [abs(row["diff"]) for row in comparisons]
        average_abs_diff = sum(absolute_diffs) / len(absolute_diffs)
        within_15_points = sum(1 for diff in absolute_diffs if diff <= 15)

        worst = sorted(comparisons, key=lambda row: abs(row["diff"]), reverse=True)[:5]
        self.assertLessEqual(average_abs_diff, 12.0, worst)
        self.assertGreaterEqual(within_15_points / len(comparisons), 0.75, worst)

        sat_rows = [row for row in comparisons if row["exam"] == "SAT"]
        self.assertTrue(sat_rows)
        self.assertLessEqual(max(abs(row["diff"]) for row in sat_rows), 25, sat_rows)


if __name__ == "__main__":
    unittest.main()

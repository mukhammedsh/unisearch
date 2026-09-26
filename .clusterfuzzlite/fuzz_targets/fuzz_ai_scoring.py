#!/usr/bin/env python3
"""Fuzz target for UniSearch AI scoring and ranking algorithms.

Fuzzes the core ranking and evaluation logic:
- sort_universities_ai: multi-factor ranking against real university dataset
- estimate_uni_chance: chance probability calculations
- estimate_university_roi: return-on-investment calculations
- finance_modes: tuition, breakdown, and mode normalizers
"""
import os
import sys

# Ensure backend modules can be imported
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(current_dir, "..", "..", "backend"))
if os.path.isdir(backend_dir) and backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)
else:
    # ClusterFuzzLite packages backend/app directly under python search path
    src_dir = os.path.abspath(os.path.join(current_dir, "..", ".."))
    if src_dir not in sys.path:
        sys.path.insert(0, src_dir)

os.environ["ML_SEMANTIC_EMBEDDINGS_ENABLED"] = "0"
os.environ["RATE_LIMIT_ENABLED"] = "0"

from app.services import ai_scoring, finance_modes, universities

# Pre-load sample universities once to avoid repeated disk reads during fuzzing
ALL_UNIVERSITIES = universities.load_universities()
SAMPLE_UNIVERSITIES = ALL_UNIVERSITIES[:5] if ALL_UNIVERSITIES else []


def _generate_fuzzed_profile(fdp) -> dict:
    """Construct a semi-structured user profile from fuzzed byte stream."""
    gpa_raw = fdp.ConsumeUnicodeNoSurrogates(16)
    budget_raw = fdp.ConsumeUnicodeNoSurrogates(24)
    major_raw = fdp.ConsumeUnicodeNoSurrogates(48)
    country_raw = fdp.ConsumeUnicodeNoSurrogates(32)
    funding_raw = fdp.ConsumeUnicodeNoSurrogates(16)
    mode_raw = fdp.ConsumeUnicodeNoSurrogates(24)

    # Build fuzzed exam list
    num_exams = fdp.ConsumeIntInRange(0, 4)
    exams = []
    for _ in range(num_exams):
        exams.append({
            "name": fdp.ConsumeUnicodeNoSurrogates(16),
            "score": fdp.ConsumeUnicodeNoSurrogates(12),
        })

    # Build fuzzed language list
    num_langs = fdp.ConsumeIntInRange(0, 3)
    languages = []
    for _ in range(num_langs):
        languages.append({
            "name": fdp.ConsumeUnicodeNoSurrogates(16),
            "score": fdp.ConsumeUnicodeNoSurrogates(12),
        })

    return {
        "gpa": gpa_raw,
        "budget": budget_raw,
        "major": major_raw,
        "preferred_country": country_raw,
        "funding_preference": funding_raw,
        "study_mode": mode_raw,
        "exams": exams,
        "languages": languages,
        "custom_notes": fdp.ConsumeUnicodeNoSurrogates(64),
    }


def TestOneInput(data: bytes) -> None:
    """Core fuzz test iteration. Receives raw fuzzed bytes from fuzzer."""
    if len(data) < 8:
        return

    try:
        import atheris
        fdp = atheris.FuzzedDataProvider(data)
    except ImportError:
        # Fallback provider for standalone / test runs without atheris
        from app.core.fuzz_helpers import SimpleFuzzedDataProvider
        fdp = SimpleFuzzedDataProvider(data)

    profile = _generate_fuzzed_profile(fdp)

    # Sliders can be numbers, None, boundary values, or unexpected types
    practice_vs_science = fdp.ConsumeIntInRange(-50, 150)
    social_vs_hardcore = fdp.ConsumeIntInRange(-50, 150)
    budget_vs_prestige = fdp.ConsumeIntInRange(-50, 150)
    city_vs_campus = fdp.ConsumeIntInRange(-50, 150)
    ai_balance = fdp.ConsumeIntInRange(-50, 150)
    admission_bias = fdp.ConsumeIntInRange(-50, 150)

    # 1. Exercise AI university ranking with real university data
    try:
        ranked = ai_scoring.sort_universities_ai(
            SAMPLE_UNIVERSITIES,
            profile=profile,
            practice_vs_science=practice_vs_science,
            social_vs_hardcore=social_vs_hardcore,
            budget_vs_prestige=budget_vs_prestige,
            city_vs_campus=city_vs_campus,
            ai_balance=ai_balance,
            admission_bias=admission_bias,
        )
        assert isinstance(ranked, list)
    except (TypeError, ValueError, KeyError) as e:
        # Expected safe rejections for non-conforming inputs
        pass

    # 2. Exercise UniChance estimation on individual universities
    for uni in SAMPLE_UNIVERSITIES[:2]:
        try:
            chance_res = ai_scoring.estimate_uni_chance(uni, profile=profile)
            assert isinstance(chance_res, dict)
        except (TypeError, ValueError, KeyError):
            # Expected: malformed fuzz profile data is safely rejected by UniChance scoring
            pass

    # 3. Exercise ROI calculation
    for uni in SAMPLE_UNIVERSITIES[:2]:
        try:
            roi_res = ai_scoring.estimate_university_roi(uni, profile=profile)
            assert isinstance(roi_res, dict)
        except (TypeError, ValueError, KeyError):
            # Expected: malformed fuzz profile data is safely rejected by ROI estimation
            pass

    # 4. Exercise finance mode parsing and breakdown extraction
    test_mode = profile.get("study_mode")
    for uni in SAMPLE_UNIVERSITIES[:2]:
        fin = uni.get("finance")
        if fin and isinstance(fin, dict):
            breakdown = finance_modes.mode_breakdown_from_finance(fin, test_mode)
            finance_modes.mode_total_from_finance(fin, test_mode)
            if isinstance(breakdown, dict):
                finance_modes.extract_tuition_cost(breakdown)


def main():
    try:
        import atheris
        atheris.instrument_all()
        atheris.Setup(sys.argv, TestOneInput)
        atheris.Fuzz()
    except ImportError:
        print("Atheris not installed in local environment; running in standalone verification mode...")
        import random
        # Run 200 iterations with pseudo-random byte sequences
        rng = random.Random(42)
        for i in range(200):
            sample_len = rng.randint(16, 512)
            sample_bytes = bytes([rng.randint(0, 255) for _ in range(sample_len)])
            TestOneInput(sample_bytes)
        print("Standalone verification succeeded: 200 fuzz iterations executed with 0 unhandled exceptions.")


if __name__ == "__main__":
    main()

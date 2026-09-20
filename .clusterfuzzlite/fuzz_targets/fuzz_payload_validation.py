#!/usr/bin/env python3
"""Fuzz target for UniSearch FastAPI payload models and schemas.

Fuzzes JSON decoding, Pydantic model validation, and schema coercion for:
- UniversitiesAiSortRequest
- CompareProfilesRequest
- ProfilePayload
- ExamValidateRequest
- LanguageValidateRequest
"""
import os
import sys
import json

# Ensure backend modules can be imported
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(current_dir, "..", "..", "backend"))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from pydantic import ValidationError
from app.schemas.payloads import (
    UniversitiesAiSortRequest,
    CompareProfilesRequest,
    ProfilePayload,
    ExamValidateRequest,
    LanguageValidateRequest,
)


def TestOneInput(data: bytes) -> None:
    """Core fuzz test iteration. Feeds arbitrary byte streams into Pydantic models."""
    if len(data) < 4:
        return

    # Attempt 1: treat raw bytes as UTF-8 string for JSON parsing
    try:
        text = data.decode("utf-8", errors="ignore")
        try:
            parsed = json.loads(text)
        except Exception:
            parsed = None

        if isinstance(parsed, dict):
            for model_cls in (
                UniversitiesAiSortRequest,
                CompareProfilesRequest,
                ProfilePayload,
                ExamValidateRequest,
                LanguageValidateRequest,
            ):
                try:
                    instance = model_cls.model_validate(parsed)
                    assert instance is not None
                except ValidationError:
                    # Expected graceful validation failure on malformed schema
                    pass
    except Exception as e:
        # Pydantic must never crash with unhandled non-validation exceptions
        raise AssertionError(f"Unexpected non-ValidationError crash: {type(e).__name__}: {e}")

    # Attempt 2: structured field fuzzing via FuzzedDataProvider
    try:
        import atheris
        fdp = atheris.FuzzedDataProvider(data)
    except ImportError:
        from app.core.fuzz_helpers import SimpleFuzzedDataProvider
        fdp = SimpleFuzzedDataProvider(data)

    synth_dict = {
        "profile": {
            "gpa": fdp.ConsumeUnicodeNoSurrogates(16),
            "budget": fdp.ConsumeUnicodeNoSurrogates(24),
            "major": fdp.ConsumeUnicodeNoSurrogates(32),
            "preferred_country": fdp.ConsumeUnicodeNoSurrogates(24),
            "funding_preference": fdp.ConsumeUnicodeNoSurrogates(16),
            "study_mode": fdp.ConsumeUnicodeNoSurrogates(16),
            "exams": [
                {
                    "name": fdp.ConsumeUnicodeNoSurrogates(16),
                    "score": fdp.ConsumeUnicodeNoSurrogates(12),
                }
            ],
            "languages": [
                {
                    "name": fdp.ConsumeUnicodeNoSurrogates(16),
                    "score": fdp.ConsumeUnicodeNoSurrogates(12),
                }
            ],
        },
        "practice_vs_science": fdp.ConsumeIntInRange(-100, 200),
        "social_vs_hardcore": fdp.ConsumeIntInRange(-100, 200),
        "budget_vs_prestige": fdp.ConsumeIntInRange(-100, 200),
        "city_vs_campus": fdp.ConsumeIntInRange(-100, 200),
        "ai_balance": fdp.ConsumeIntInRange(-100, 200),
        "admission_bias": fdp.ConsumeIntInRange(-100, 200),
        "page": fdp.ConsumeIntInRange(-10, 100),
        "page_size": fdp.ConsumeIntInRange(-10, 200),
    }

    try:
        UniversitiesAiSortRequest.model_validate(synth_dict)
    except ValidationError:
        # Expected: synthetic malformed payload triggers schema validation error
        pass


def main():
    try:
        import atheris
        atheris.instrument_all()
        atheris.Setup(sys.argv, TestOneInput)
        atheris.Fuzz()
    except ImportError:
        print("Atheris not installed in local environment; running in standalone verification mode...")
        import random
        rng = random.Random(42)
        for i in range(200):
            sample_len = rng.randint(4, 512)
            sample_bytes = bytes([rng.randint(0, 255) for _ in range(sample_len)])
            TestOneInput(sample_bytes)
        print("Standalone verification succeeded: 200 payload fuzz iterations executed with 0 unhandled exceptions.")


if __name__ == "__main__":
    main()

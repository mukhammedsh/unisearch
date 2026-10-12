# Sentinel Journal - Security Learnings

## 2026-10-12 - Non-finite float validation in custom Pydantic before-validators
**Vulnerability:** `LanguageValidateRequest` accepted non-finite float scores (`NaN`, `inf`, `-inf`) because `score < 0 or score > 10000` evaluates to `False` for `NaN`.
**Learning:** When custom `@field_validator(..., mode="before")` handles `Union[float, int, str]` before Pydantic's built-in numeric bounds check, float comparisons like `<` or `>` do not reject `NaN`.
**Prevention:** Explicitly check `(isinstance(value, float) and not math.isfinite(value))` in custom pre-validators for numeric fields.

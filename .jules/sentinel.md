## 2026-09-21 - Boolean Query Parameter Discrepancy in Middleware Guards
**Vulnerability:** `/health?warmup=t` bypassed `is_protected_ops_request` middleware guard because the guard checked a subset of truthy strings (`{"1", "true", "yes", "on"}`), while FastAPI/Pydantic parsed `"t"` and `"y"` as `True`.
**Learning:** Hand-rolled string matches in middleware or security guards can diverge from framework-level type coercion (e.g. FastAPI/Pydantic `TypeAdapter(bool)` accepting `t`/`y`), creating auth bypass gaps.
**Prevention:** Ensure custom route security guards align with framework-level query parameter parser truthy/falsy sets (`1`, `true`, `yes`, `on`, `t`, `y`).

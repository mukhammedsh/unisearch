import os


# Test package marker for shared fixtures/utilities imports.
os.environ.setdefault("OPS_ADMIN_TOKEN", "test-ops-token")
os.environ.setdefault("RATE_LIMIT_ENABLED", "0")
os.environ.setdefault("ML_SEMANTIC_EMBEDDINGS_ENABLED", "0")
os.environ.setdefault("ML_INTEREST_TRANSLATION_ENABLED", "0")
os.environ.setdefault("AUTO_WARMUP_ON_STARTUP", "0")
os.environ.setdefault("REDIS_URL", "")

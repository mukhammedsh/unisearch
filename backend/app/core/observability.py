import logging
from typing import Any

from fastapi import FastAPI

from app.core.settings import (
    METRICS_ENABLED,
    METRICS_PATH,
    SENTRY_DSN,
    SENTRY_TRACES_SAMPLE_RATE,
)

try:
    from prometheus_fastapi_instrumentator import Instrumentator
except Exception:  # pragma: no cover - optional dependency
    Instrumentator = None  # type: ignore[assignment]

try:
    import sentry_sdk
except Exception:  # pragma: no cover - optional dependency
    sentry_sdk = None  # type: ignore[assignment]


logger = logging.getLogger("unisearch.observability")


def setup_observability(app: FastAPI) -> None:
    if SENTRY_DSN and sentry_sdk is not None:
        try:
            sentry_sdk.init(
                dsn=SENTRY_DSN,
                traces_sample_rate=max(0.0, min(1.0, float(SENTRY_TRACES_SAMPLE_RATE))),
            )
            logger.info("sentry_enabled traces_sample_rate=%s", SENTRY_TRACES_SAMPLE_RATE)
        except Exception:
            logger.exception("sentry_init_failed")

    if METRICS_ENABLED and Instrumentator is not None:
        try:
            instrumentator: Any = Instrumentator(
                should_group_status_codes=True,
                should_ignore_untemplated=True,
                excluded_handlers=["/metrics"],
            )
            instrumentator.instrument(app).expose(
                app,
                endpoint=METRICS_PATH,
                include_in_schema=False,
            )
            logger.info("metrics_enabled endpoint=%s", METRICS_PATH)
        except Exception:
            logger.exception("metrics_init_failed")

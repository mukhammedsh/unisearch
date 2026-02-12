from typing import Any, Dict

from app.core.redis_store import get_redis_client, is_redis_configured, redis_runtime_status
from app.core.settings import QUEUE_ENABLED, QUEUE_NAME

try:
    from rq import Queue
except Exception:  # pragma: no cover - optional dependency
    Queue = None  # type: ignore[assignment]


def queue_runtime_status() -> Dict[str, Any]:
    if not QUEUE_ENABLED:
        return {
            "enabled": False,
            "available": False,
            "name": QUEUE_NAME,
            "reason": "disabled",
            "pending_jobs": 0,
        }
    if Queue is None:
        return {
            "enabled": True,
            "available": False,
            "name": QUEUE_NAME,
            "reason": "dependency_missing",
            "pending_jobs": 0,
        }
    if not is_redis_configured():
        return {
            "enabled": True,
            "available": False,
            "name": QUEUE_NAME,
            "reason": "redis_not_configured",
            "pending_jobs": 0,
        }

    redis_status = redis_runtime_status(force_check=True)
    if not bool(redis_status.get("available")):
        return {
            "enabled": True,
            "available": False,
            "name": QUEUE_NAME,
            "reason": str(redis_status.get("reason") or "redis_unavailable"),
            "pending_jobs": 0,
        }

    conn = get_redis_client()
    if conn is None:
        return {
            "enabled": True,
            "available": False,
            "name": QUEUE_NAME,
            "reason": "redis_client_unavailable",
            "pending_jobs": 0,
        }

    pending = 0
    try:
        pending = int(Queue(QUEUE_NAME, connection=conn).count)
    except Exception:
        pending = 0

    return {
        "enabled": True,
        "available": True,
        "name": QUEUE_NAME,
        "reason": "ok",
        "pending_jobs": max(0, pending),
    }


def enqueue_warmup_task(trigger: str = "manual") -> Dict[str, Any]:
    status = queue_runtime_status()
    if not bool(status.get("available")):
        return {
            "enqueued": False,
            "queue": status.get("name"),
            "reason": status.get("reason"),
        }

    conn = get_redis_client()
    if conn is None or Queue is None:
        return {"enqueued": False, "queue": QUEUE_NAME, "reason": "queue_unavailable"}

    try:
        queue = Queue(QUEUE_NAME, connection=conn, default_timeout=300)
        job = queue.enqueue(
            "app.services.background_tasks.warmup_runtime",
            kwargs={"trigger": str(trigger or "manual")},
            result_ttl=900,
            failure_ttl=86400,
        )
        return {
            "enqueued": True,
            "queue": QUEUE_NAME,
            "job_id": str(job.id),
        }
    except Exception:
        return {"enqueued": False, "queue": QUEUE_NAME, "reason": "enqueue_failed"}

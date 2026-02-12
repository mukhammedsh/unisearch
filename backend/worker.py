import sys

from app.core.redis_store import get_redis_client, redis_runtime_status
from app.core.settings import QUEUE_NAME

try:
    from rq import Queue, Worker
except Exception:
    Queue = None  # type: ignore[assignment]
    Worker = None  # type: ignore[assignment]


def main() -> int:
    if Queue is None or Worker is None:
        print("RQ is not installed. Install dependencies from requirements.txt.", file=sys.stderr)
        return 1

    redis_status = redis_runtime_status(force_check=True)
    if not bool(redis_status.get("available")):
        print(f"Redis is unavailable: {redis_status.get('reason')}", file=sys.stderr)
        return 1

    conn = get_redis_client()
    if conn is None:
        print("Redis client is unavailable.", file=sys.stderr)
        return 1

    queue = Queue(QUEUE_NAME, connection=conn)
    worker = Worker([queue], connection=conn, name=f"unisearch-worker-{QUEUE_NAME}")
    worker.work(with_scheduler=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

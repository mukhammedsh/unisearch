from pathlib import Path
import os


def load_local_env() -> None:
    """
    Minimal .env loader (no extra dependency).
    Looks for backend/.env and sets missing os.environ keys.
    """
    try:
        current_dir = Path(__file__).resolve().parent
        backend_dir = current_dir.parent.parent
        env_path = backend_dir / ".env"
        if not env_path.exists():
            return
        for raw_line in env_path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            k = key.strip()
            v = value.strip().strip('"').strip("'")
            if k and k not in os.environ:
                os.environ[k] = v
    except Exception:
        return

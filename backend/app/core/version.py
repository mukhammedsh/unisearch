import json

from app.core.paths import BACKEND_DIR


def _read_package_version() -> str:
    candidates = [
        BACKEND_DIR / "package.json",
        BACKEND_DIR.parent / "package.json",
    ]

    for package_path in candidates:
        if not package_path.exists():
            continue
        try:
            payload = json.loads(package_path.read_text(encoding="utf-8"))
        except Exception:
            continue

        version = str(payload.get("version") or "").strip()
        if version:
            return version

    return "0.0.0-dev"


APP_VERSION = _read_package_version()

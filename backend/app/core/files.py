import os
from typing import Optional


class RequiredDataUnavailable(RuntimeError):
    pass


def file_mtime(path: str) -> Optional[float]:
    try:
        return os.path.getmtime(path)
    except Exception:
        return None

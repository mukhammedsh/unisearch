import os


class RequiredDataUnavailable(RuntimeError):
    pass


def file_mtime(path: str) -> float | None:
    try:
        return os.path.getmtime(path)
    except Exception:
        return None

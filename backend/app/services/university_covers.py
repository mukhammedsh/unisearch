"""Report whether a university has a credited campus cover image to request."""

from __future__ import annotations

from app.core import paths

_COVER_FOLDERS = ("thumbnails", "thumbnails-medium", "thumbnails-small")
_COVER_FORMATS = ("webp", "jpg")


def cover_available(university_id: str) -> bool:
    """True when every size and format the interface may request exists on disk.

    The interface skips the image request when this is false, so a university
    without a photograph does not produce 404 responses.
    """
    uid = str(university_id or "").strip()
    if not uid or "/" in uid or "\\" in uid or ".." in uid:
        return False
    root = paths.UNIVERSITY_ASSETS_DIR
    return all((root / folder / f"{uid}.{extension}").is_file()
               for folder in _COVER_FOLDERS for extension in _COVER_FORMATS)

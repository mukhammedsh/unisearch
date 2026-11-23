"""Shared HTTP conditional-request (ETag) and request-locale helpers."""

from __future__ import annotations

from app.core.utils import normalize_search_lang
from fastapi import Request, Response


def etag_matches(if_none_match: str, etag: str) -> bool:
    """Return True when an If-None-Match header matches *etag* (strong or weak)."""
    raw = str(if_none_match or "").strip()
    if not raw:
        return False
    if raw == "*":
        return True
    target = etag.strip()
    target_weak = f"W/{target}"
    candidates = [part.strip() for part in raw.split(",") if part.strip()]
    return target in candidates or target_weak in candidates


def apply_etag_or_not_modified(
    request: Request | None,
    response: Response | None,
    *,
    etag: str,
    cache_control: str,
    vary: str = "Accept-Language",
) -> Response | None:
    """Set caching headers on *response* and return a 304 Response when matched."""
    headers = {
        "Cache-Control": cache_control,
        "ETag": etag,
        "Vary": vary,
    }
    if response is not None:
        response.headers.update(headers)
    if_none_match = request.headers.get("if-none-match", "") if request is not None else ""
    if etag_matches(if_none_match, etag):
        return Response(status_code=304, headers=headers)
    return None


def resolve_search_lang(explicit_lang: object, request: Request | None) -> str:
    """Resolve explicit ?lang query override or fallback to the primary Accept-Language tag."""
    if str(explicit_lang or "").strip():
        return normalize_search_lang(explicit_lang)
    raw_header = str(request.headers.get("accept-language", "")).strip() if request is not None else ""
    primary_tag = raw_header.split(",")[0].strip() if raw_header else ""
    return normalize_search_lang(primary_tag)

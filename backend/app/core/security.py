from fastapi import HTTPException, Request
from app.core.settings import MENTOR_API_KEY


def require_mentor_api_key(request: Request) -> None:
    if not MENTOR_API_KEY:
        return
    token = request.headers.get("x-api-key") or ""
    auth = request.headers.get("authorization") or ""
    if auth.lower().startswith("bearer "):
        token = auth[7:].strip()
    token = (token or "").strip()
    if not token or token != MENTOR_API_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")

from fastapi import APIRouter, Request
from typing import Any, Dict

from app.core.security import require_mentor_api_key
from app.services import mentor as mentor_service


router = APIRouter()


@router.post("/mentor/ask")
def mentor_ask(payload: Dict[str, Any], request: Request):
    require_mentor_api_key(request)
    return mentor_service.mentor_ask(payload)

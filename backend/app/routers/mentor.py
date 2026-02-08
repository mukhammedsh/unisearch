from fastapi import APIRouter, Request, Response

from app.core.security import enforce_mentor_rate_limit, require_mentor_api_key
from app.schemas import MentorAskRequest
from app.services import mentor as mentor_service


router = APIRouter()


@router.post("/mentor/ask")
def mentor_ask(payload: MentorAskRequest, request: Request, response: Response):
    require_mentor_api_key(request)
    rate_headers = enforce_mentor_rate_limit(request)
    for key, value in rate_headers.items():
        response.headers[key] = value
    response.headers["Cache-Control"] = "no-store"
    return mentor_service.mentor_ask(payload.model_dump(exclude_none=True))

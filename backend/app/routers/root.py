from fastapi import APIRouter


router = APIRouter()


@router.get("/")
def root():
    return {"status": "ok", "service": "uniesearch-backend-ai", "version": "2.1.0 Beta"}

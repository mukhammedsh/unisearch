from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.settings import FRONTEND_ORIGIN
from app.routers import root, universities, exams, languages, mentor


app = FastAPI(title="UniSearch AI API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(root.router)
app.include_router(universities.router)
app.include_router(exams.router)
app.include_router(languages.router)
app.include_router(mentor.router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)

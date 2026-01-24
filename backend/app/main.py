from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import json
import os
from typing import Any

app = FastAPI(title="UniSearch API", version="0.1.0")

# CORS (Alpha: можно оставить "*", позже ограничите до localhost фронтенда)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # backend/
DATA_PATH = os.path.join(BASE_DIR, "data", "universities.json")

def load_universities() -> list[dict[str, Any]]:
    if not os.path.exists(DATA_PATH):
        return []
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, list):
        raise ValueError("universities.json должен быть JSON-массивом")
    return data

@app.get("/")
def root():
    return {"status": "ok", "service": "uniesearch-backend", "storage": "json"}

@app.get("/universities")
def list_universities(limit: int = 200):
    items = load_universities()[: max(0, limit)]
    return {"items": items, "count": len(items)}

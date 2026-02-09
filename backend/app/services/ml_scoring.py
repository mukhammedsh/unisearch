import json
from pathlib import Path
from typing import Any, Dict, List

from app.core.paths import DATA_PATH

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity

    _SKLEARN_AVAILABLE = True
except Exception:
    TfidfVectorizer = None  # type: ignore[assignment]
    cosine_similarity = None  # type: ignore[assignment]
    _SKLEARN_AVAILABLE = False


def _safe_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


class MLRecommender:
    """Singleton recommender using TF-IDF vectors over university metadata text."""
    _instance = None

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self, data_path: str = DATA_PATH) -> None:
        if getattr(self, "_initialized", False):
            return
        self._initialized = True

        self.data_path = Path(data_path)
        self._data_mtime: float = -1.0
        self._university_ids: List[str] = []
        self._vectorizer = None
        self._tfidf_matrix = None
        self._load_and_fit()

    def _read_universities(self) -> List[Dict[str, Any]]:
        try:
            data = json.loads(self.data_path.read_text(encoding="utf-8"))
        except Exception:
            return []
        if not isinstance(data, list):
            return []
        return [row for row in data if isinstance(row, dict)]

    def prepare_text_features(self, universities: List[Dict[str, Any]]) -> List[str]:
        """Build TF-IDF text features from program names, location, and optional metadata."""
        docs: List[str] = []
        for uni in universities:
            name = _safe_text(uni.get("name"))

            location = uni.get("location", {})
            city = _safe_text(location.get("city")) if isinstance(location, dict) else ""
            country = _safe_text(location.get("country")) if isinstance(location, dict) else ""
            location_text = " ".join(part for part in (city, country) if part)

            program_names: List[str] = []
            academics = uni.get("academics", {})
            if isinstance(academics, dict):
                programs = academics.get("programs", [])
                if isinstance(programs, list):
                    for row in programs:
                        if not isinstance(row, dict):
                            continue
                        p_name = _safe_text(row.get("name"))
                        if p_name:
                            program_names.append(p_name)

            program_text = " ".join(program_names)
            description = _safe_text(uni.get("description"))

            tags_text = ""
            tags = uni.get("tags", [])
            if isinstance(tags, list):
                tags_text = " ".join(_safe_text(tag) for tag in tags if _safe_text(tag))
            elif isinstance(tags, str):
                tags_text = _safe_text(tags)

            major_focus_text = ""
            major_focus = uni.get("major_focus", [])
            if isinstance(major_focus, list):
                major_focus_text = " ".join(_safe_text(item) for item in major_focus if _safe_text(item))
            elif isinstance(major_focus, str):
                major_focus_text = _safe_text(major_focus)

            soup = " ".join(
                part
                for part in (
                    name,
                    location_text,
                    program_text,
                    major_focus_text,
                    tags_text,
                    description,
                )
                if part
            ).strip()
            docs.append(soup or "university")
        return docs

    def _load_and_fit(self) -> None:
        try:
            self._data_mtime = self.data_path.stat().st_mtime
        except Exception:
            self._data_mtime = -1.0

        universities = self._read_universities()
        self._university_ids = [str(u.get("id", "")).strip() for u in universities]

        if not _SKLEARN_AVAILABLE or not universities:
            self._vectorizer = None
            self._tfidf_matrix = None
            return

        docs = self.prepare_text_features(universities)
        try:
            # TF-IDF: converts metadata text into weighted vectors where
            # terms that are frequent in one university profile but rarer globally
            # get higher importance.
            self._vectorizer = TfidfVectorizer(stop_words="english")
            self._tfidf_matrix = self._vectorizer.fit_transform(docs)
        except Exception:
            self._vectorizer = None
            self._tfidf_matrix = None

    def _ensure_fresh(self) -> None:
        try:
            mtime = self.data_path.stat().st_mtime
        except Exception:
            mtime = -1.0
        if mtime != self._data_mtime:
            self._load_and_fit()

    def predict_relevance(self, user_interests: str) -> Dict[str, float]:
        """Match user interests to universities via cosine similarity of TF-IDF vectors."""
        self._ensure_fresh()
        query = _safe_text(user_interests)

        ids = [uid for uid in self._university_ids if uid]
        if not ids:
            return {}
        if (
            not query
            or self._vectorizer is None
            or self._tfidf_matrix is None
            or cosine_similarity is None
        ):
            return {uid: 0.0 for uid in ids}

        try:
            query_vec = self._vectorizer.transform([query])
            # Cosine similarity measures how close vector directions are.
            # Higher value means the university metadata is semantically closer
            # to the user's interest text.
            sims = cosine_similarity(query_vec, self._tfidf_matrix).ravel()
        except Exception:
            return {uid: 0.0 for uid in ids}

        out: Dict[str, float] = {}
        for uid, score in zip(self._university_ids, sims):
            if not uid:
                continue
            out[uid] = float(max(0.0, min(1.0, float(score))))
        return out


def get_ml_recommender() -> MLRecommender:
    return MLRecommender()

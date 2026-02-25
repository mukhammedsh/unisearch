import json
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.core.paths import DATA_PATH
from app.core.settings import (
    ML_SEMANTIC_EMBEDDINGS_BATCH_SIZE,
    ML_SEMANTIC_EMBEDDINGS_DEVICE,
    ML_SEMANTIC_EMBEDDINGS_E5_PREFIX,
    ML_SEMANTIC_EMBEDDINGS_ENABLED,
    ML_SEMANTIC_EMBEDDINGS_MODEL,
)

try:
    import numpy as np

    _NUMPY_AVAILABLE = True
except Exception:
    np = None  # type: ignore[assignment]
    _NUMPY_AVAILABLE = False

try:
    from sentence_transformers import SentenceTransformer

    _SENTENCE_TRANSFORMERS_AVAILABLE = True
except Exception:
    SentenceTransformer = None  # type: ignore[assignment]
    _SENTENCE_TRANSFORMERS_AVAILABLE = False

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


# Query/corpus normalization for abbreviated and colloquial terms.
# This improves recall for short user phrases like "gamedev", "ict", "cs", etc.
_PHRASE_EXPANSIONS = {
    r"\bgamedev\b": "game development game design computer graphics interactive media",
    r"\bgame\s*dev\b": "game development game design computer graphics interactive media",
    r"\bcomp\s*sci\b": "computer science",
    r"\bdata\s*sci\b": "data science",
    r"\bsoft\s*eng\b": "software engineering",
    r"\bsoft\s*dev\b": "software development",
    r"\bcyber\s*sec\b": "cybersecurity information security",
    r"\bdata\s*eng\b": "data engineering data pipelines",
    r"\bgame\s*design\b": "game design interactive media computer graphics",
    r"\bui\s*/\s*ux\b": "user interface user experience",
    r"\bux\s*/\s*ui\b": "user experience user interface",
    r"\buiux\b": "user interface user experience",
    r"\buxui\b": "user experience user interface",
    r"\bfull\s*stack\b": "fullstack frontend backend software engineering",
    r"\bfront\s*end\b": "frontend user interface web development",
    r"\bback\s*end\b": "backend server distributed systems",
    r"\bweb\s*dev\b": "web development frontend backend",
    r"\bapp\s*dev\b": "application development software engineering",
    r"\bmachine\s*vision\b": "computer vision image processing",
    r"\bai\s*ml\b": "artificial intelligence machine learning",
    r"\bgen\s*ai\b": "generative ai large language models artificial intelligence",
    r"\binfo\s*sec\b": "information security cybersecurity",
    r"\bfin\s*tech\b": "financial technology fintech",
    r"\bed\s*tech\b": "education technology edtech",
    r"\bhealth\s*tech\b": "health technology digital health",
    r"\bagri\s*tech\b": "agricultural technology smart agriculture",
}

_TOKEN_EXPANSIONS = {
    "ai": ["artificial intelligence", "machine learning"],
    "ml": ["machine learning", "statistical learning"],
    "dl": ["deep learning", "neural networks"],
    "llm": ["large language models", "natural language processing"],
    "nlp": ["natural language processing", "computational linguistics"],
    "cv": ["computer vision", "image processing"],
    "ds": ["data science", "data analytics", "statistics"],
    "da": ["data analytics", "data analysis"],
    "de": ["data engineering", "data pipelines"],
    "se": ["software engineering"],
    "swe": ["software engineering"],
    "cs": ["computer science"],
    "ict": ["information communication technology", "digital technology", "computer science"],
    "isys": ["information systems"],
    "mis": ["management information systems"],
    "db": ["database", "data management"],
    "sql": ["structured query language", "database"],
    "nosql": ["non relational database", "distributed database"],
    "hci": ["human computer interaction", "user experience"],
    "ui": ["user interface", "interaction design"],
    "ux": ["user experience", "interaction design"],
    "frontend": ["web development", "user interface"],
    "backend": ["server engineering", "distributed systems"],
    "fullstack": ["frontend", "backend", "web development"],
    "devops": ["continuous integration", "continuous delivery", "platform engineering"],
    "mlops": ["machine learning operations", "model deployment"],
    "qa": ["quality assurance", "software testing"],
    "sdet": ["software testing", "automation testing"],
    "pm": ["product management", "project management"],
    "po": ["product owner", "product management"],
    "ba": ["business analytics", "business analysis"],
    "erp": ["enterprise resource planning", "information systems"],
    "crm": ["customer relationship management", "information systems"],
    "iot": ["internet of things", "embedded systems"],
    "iiot": ["industrial internet of things", "automation"],
    "embedded": ["embedded systems", "hardware software integration"],
    "robotics": ["robotics", "automation", "control systems"],
    "ar": ["augmented reality", "immersive technology"],
    "vr": ["virtual reality", "immersive technology"],
    "xr": ["extended reality", "immersive technology"],
    "gpu": ["parallel computing", "high performance computing"],
    "hpc": ["high performance computing", "parallel computing"],
    "os": ["operating systems", "systems programming"],
    "algo": ["algorithms", "computational thinking"],
    "algos": ["algorithms", "computational thinking"],
    "oop": ["object oriented programming", "software design"],
    "cpp": ["c plus plus", "systems programming"],
    "csharp": ["c sharp", "software engineering"],
    "js": ["javascript", "web development"],
    "ts": ["typescript", "web development"],
    "py": ["python", "programming"],
    "programming": ["software development", "coding", "computer science"],
    "coding": ["programming", "software development"],
    "gamedev": ["game development", "game design", "computer graphics", "interactive media"],
    "gamedesign": ["game design", "interactive media", "computer graphics"],
    "gameart": ["game art", "computer graphics", "digital media"],
    "gamification": ["gamification", "interactive design", "learning technologies"],
    "cg": ["computer graphics", "visual computing"],
    "vfx": ["visual effects", "computer graphics"],
    "3d": ["three dimensional", "computer graphics"],
    "animation": ["computer graphics", "interactive media"],
    "cyber": ["cybersecurity", "information security", "network security"],
    "cybersec": ["cybersecurity", "information security", "network security"],
    "infosec": ["information security", "cybersecurity"],
    "sec": ["security engineering", "cybersecurity"],
    "appsec": ["application security", "secure software"],
    "netsec": ["network security", "cybersecurity"],
    "cloud": ["cloud computing", "distributed systems"],
    "genai": ["generative ai", "large language models", "artificial intelligence"],
    "rag": ["retrieval augmented generation", "information retrieval", "natural language processing"],
    "agentic": ["ai agents", "autonomous systems", "artificial intelligence"],
    "saas": ["software as a service", "cloud computing"],
    "iaas": ["infrastructure as a service", "cloud computing"],
    "paas": ["platform as a service", "cloud computing"],
    "fintech": ["financial technology", "data analytics", "software engineering"],
    "edtech": ["education technology", "learning systems"],
    "healthtech": ["health technology", "digital health"],
    "biotech": ["biotechnology", "life sciences"],
    "medtech": ["medical technology", "biomedical engineering"],
    "biomed": ["biomedical engineering", "life sciences"],
    "ee": ["electrical engineering"],
    "ece": ["electrical and computer engineering"],
    "mech": ["mechanical engineering"],
    "ce": ["civil engineering"],
    "che": ["chemical engineering"],
    "chemeng": ["chemical engineering"],
    "mateng": ["materials engineering", "materials science"],
    "biochem": ["biochemistry", "life sciences"],
    "aero": ["aerospace engineering"],
    "ae": ["aerospace engineering"],
    "env": ["environmental engineering", "sustainability"],
    "sust": ["sustainability", "climate", "environment"],
    "biz": ["business", "management", "entrepreneurship"],
    "econ": ["economics", "econometrics"],
    "econfin": ["economics", "finance", "quantitative analysis"],
    "product": ["product management", "innovation", "user needs"],
    "entrepreneurship": ["startups", "innovation", "business"],
    "startup": ["startups", "entrepreneurship", "innovation"],
    "startups": ["entrepreneurship", "innovation", "business"],
    "phd": ["doctorate", "research"],
    "msc": ["masters", "graduate study"],
    "bsc": ["bachelor", "undergraduate study"],
}


def _normalize_ml_text(value: Any, for_query: bool = True) -> str:
    raw = _safe_text(value).lower()
    if not raw:
        return ""
    text = raw
    for pattern, replacement in _PHRASE_EXPANSIONS.items():
        text = re.sub(pattern, f" {replacement} ", text, flags=re.IGNORECASE)
    text = text.replace("&", " and ")
    text = re.sub(r"[^a-z0-9+.#\s-]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return ""

    tokens = text.split(" ")
    expanded: List[str] = []
    for tok in tokens:
        t = tok.strip().lower()
        if not t:
            continue
        expanded.append(t)
        if not for_query:
            continue
        canonical = re.sub(r"[^a-z0-9]+", "", t)
        if t in _TOKEN_EXPANSIONS:
            expanded.extend(_TOKEN_EXPANSIONS[t])
        elif canonical and canonical in _TOKEN_EXPANSIONS:
            expanded.extend(_TOKEN_EXPANSIONS[canonical])
    return " ".join(expanded)


class MLRecommender:
    """Singleton recommender: sentence-embeddings primary, TF-IDF fallback."""

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
        self._tfidf_ready = False

        self._semantic_model = None
        self._semantic_embeddings = None
        self._semantic_ready = False
        self._semantic_error = ""

        self._runtime_mode = "unavailable"
        self._runtime_reason = "not_ready"
        self._load_and_fit()

    def _read_universities(self) -> List[Dict[str, Any]]:
        try:
            data = json.loads(self.data_path.read_text(encoding="utf-8"))
        except Exception:
            return []
        if not isinstance(data, list):
            return []
        return [row for row in data if isinstance(row, dict)]

    def _should_use_e5_prefix(self) -> bool:
        mode = str(ML_SEMANTIC_EMBEDDINGS_E5_PREFIX or "").strip().lower()
        if mode in ("on", "true", "yes", "1"):
            return True
        if mode in ("off", "false", "no", "0"):
            return False
        return "e5" in str(ML_SEMANTIC_EMBEDDINGS_MODEL or "").strip().lower()

    def _format_semantic_passage(self, text: str) -> str:
        if self._should_use_e5_prefix():
            return f"passage: {text}"
        return text

    def _format_semantic_query(self, text: str) -> str:
        if self._should_use_e5_prefix():
            return f"query: {text}"
        return text

    def prepare_text_features(self, universities: List[Dict[str, Any]]) -> List[str]:
        """Build corpus text from university metadata for semantic and lexical matching."""
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

            admission_bits: List[str] = []
            tracks = uni.get("admission_tracks", [])
            if isinstance(tracks, list):
                for track in tracks:
                    if not isinstance(track, dict):
                        continue
                    admission_bits.append(_safe_text(track.get("label")))
                    admission_bits.append(_safe_text(track.get("description")))
                    mode_val = track.get("study_mode")
                    if isinstance(mode_val, list):
                        admission_bits.extend(_safe_text(x) for x in mode_val if _safe_text(x))
                    else:
                        admission_bits.append(_safe_text(mode_val))
                    extra = track.get("extra_requirements")
                    if isinstance(extra, list):
                        admission_bits.extend(_safe_text(x) for x in extra if _safe_text(x))

            admission_text = " ".join(part for part in admission_bits if part)

            soup = " ".join(
                part
                for part in (
                    name,
                    location_text,
                    program_text,
                    major_focus_text,
                    tags_text,
                    description,
                    admission_text,
                )
                if part
            ).strip()
            normalized = _normalize_ml_text(soup, for_query=False)
            docs.append(" ".join(part for part in (soup, normalized) if part).strip() or "university")
        return docs

    def _fit_tfidf(self, docs: List[str]) -> None:
        self._tfidf_ready = False
        self._vectorizer = None
        self._tfidf_matrix = None
        if not _SKLEARN_AVAILABLE or not docs:
            return
        try:
            self._vectorizer = TfidfVectorizer(stop_words="english")
            self._tfidf_matrix = self._vectorizer.fit_transform(docs)
            self._tfidf_ready = bool(self._vectorizer is not None and self._tfidf_matrix is not None)
        except Exception:
            self._vectorizer = None
            self._tfidf_matrix = None
            self._tfidf_ready = False

    def _fit_semantic(self, docs: List[str]) -> None:
        self._semantic_ready = False
        self._semantic_embeddings = None
        self._semantic_error = ""

        if not ML_SEMANTIC_EMBEDDINGS_ENABLED:
            self._semantic_error = "semantic_disabled"
            return
        if not _SENTENCE_TRANSFORMERS_AVAILABLE or not _NUMPY_AVAILABLE:
            self._semantic_error = "semantic_dependency_missing"
            return
        if not docs:
            self._semantic_error = "empty_corpus"
            return

        try:
            if self._semantic_model is None:
                self._semantic_model = SentenceTransformer(  # type: ignore[misc]
                    str(ML_SEMANTIC_EMBEDDINGS_MODEL),
                    device=str(ML_SEMANTIC_EMBEDDINGS_DEVICE),
                )

            passages = [self._format_semantic_passage(text) for text in docs]
            batch_size = max(1, int(ML_SEMANTIC_EMBEDDINGS_BATCH_SIZE or 32))
            embeddings = self._semantic_model.encode(  # type: ignore[union-attr]
                passages,
                batch_size=batch_size,
                show_progress_bar=False,
                convert_to_numpy=True,
                normalize_embeddings=True,
            )
            if embeddings is None or len(embeddings) == 0:
                raise RuntimeError("empty semantic embeddings")
            self._semantic_embeddings = embeddings
            self._semantic_ready = True
        except Exception as exc:
            self._semantic_error = f"semantic_init_failed:{exc}"
            self._semantic_ready = False
            self._semantic_embeddings = None

    def _load_and_fit(self) -> None:
        try:
            self._data_mtime = self.data_path.stat().st_mtime
        except Exception:
            self._data_mtime = -1.0

        universities = self._read_universities()
        self._university_ids = [str(u.get("id", "")).strip() for u in universities]

        docs = self.prepare_text_features(universities)
        self._fit_semantic(docs)
        self._fit_tfidf(docs)

        if self._semantic_ready:
            self._runtime_mode = "semantic"
            self._runtime_reason = "semantic_ready"
        elif self._tfidf_ready:
            self._runtime_mode = "tfidf"
            self._runtime_reason = "semantic_fallback_tfidf"
        else:
            self._runtime_mode = "unavailable"
            if self._semantic_error:
                self._runtime_reason = self._semantic_error
            elif not _SKLEARN_AVAILABLE:
                self._runtime_reason = "dependency_missing"
            else:
                self._runtime_reason = "model_not_ready"

    def _ensure_fresh(self) -> None:
        try:
            mtime = self.data_path.stat().st_mtime
        except Exception:
            mtime = -1.0
        if mtime != self._data_mtime:
            self._load_and_fit()

    def is_ready(self) -> bool:
        """Return True when any ML ranking backend is initialized."""
        self._ensure_fresh()
        has_ids = len([uid for uid in self._university_ids if uid]) > 0
        return bool(has_ids and (self._semantic_ready or self._tfidf_ready))

    def _predict_semantic(self, query: str) -> Optional[Dict[str, float]]:
        if (
            not self._semantic_ready
            or self._semantic_model is None
            or self._semantic_embeddings is None
            or not _NUMPY_AVAILABLE
        ):
            return None
        try:
            q = self._format_semantic_query(query)
            query_vec = self._semantic_model.encode(  # type: ignore[union-attr]
                [q],
                show_progress_bar=False,
                convert_to_numpy=True,
                normalize_embeddings=True,
            )
            if query_vec is None or len(query_vec) == 0:
                return None
            sims = self._semantic_embeddings @ query_vec[0]  # type: ignore[operator]
            sims01 = np.clip((sims + 1.0) / 2.0, 0.0, 1.0)

            out: Dict[str, float] = {}
            for uid, score in zip(self._university_ids, sims01):
                if not uid:
                    continue
                out[uid] = float(score)
            return out
        except Exception:
            return None

    def _predict_tfidf(self, query: str) -> Optional[Dict[str, float]]:
        if (
            not self._tfidf_ready
            or self._vectorizer is None
            or self._tfidf_matrix is None
            or cosine_similarity is None
        ):
            return None
        try:
            query_vec = self._vectorizer.transform([query])
            sims = cosine_similarity(query_vec, self._tfidf_matrix).ravel()
            out: Dict[str, float] = {}
            for uid, score in zip(self._university_ids, sims):
                if not uid:
                    continue
                out[uid] = float(max(0.0, min(1.0, float(score))))
            return out
        except Exception:
            return None

    def predict_relevance(self, user_interests: str) -> Dict[str, float]:
        """Match interests to universities via sentence embeddings (or TF-IDF fallback)."""
        self._ensure_fresh()
        query_raw = _safe_text(user_interests)
        query = _normalize_ml_text(query_raw, for_query=True) or query_raw

        ids = [uid for uid in self._university_ids if uid]
        if not ids:
            return {}
        if not query:
            return {uid: 0.0 for uid in ids}

        semantic = self._predict_semantic(query)
        if semantic is not None:
            return semantic

        lexical = self._predict_tfidf(query)
        if lexical is not None:
            return lexical

        return {uid: 0.0 for uid in ids}

    def runtime_status(self) -> Dict[str, Any]:
        self._ensure_fresh()
        available = self.is_ready()
        mode = "semantic" if self._semantic_ready else ("tfidf" if self._tfidf_ready else "unavailable")
        reason = self._runtime_reason

        if not available and reason in ("not_ready", ""):
            if not _SKLEARN_AVAILABLE and not _SENTENCE_TRANSFORMERS_AVAILABLE:
                reason = "dependency_missing"
            else:
                reason = "model_not_ready"

        model_name = str(ML_SEMANTIC_EMBEDDINGS_MODEL or "").strip()
        semantic_model = model_name if self._semantic_ready else ""
        return {
            "available": bool(available),
            "mode": mode,
            "reason": reason,
            "message": "" if available else "Machine Learning unavailable",
            "semanticEnabled": bool(ML_SEMANTIC_EMBEDDINGS_ENABLED),
            "semanticReady": bool(self._semantic_ready),
            "semanticModel": semantic_model,
            "semanticModelConfigured": model_name,
            "semanticDependencyAvailable": bool(_SENTENCE_TRANSFORMERS_AVAILABLE and _NUMPY_AVAILABLE),
            "tfidfReady": bool(self._tfidf_ready),
            "sklearnAvailable": bool(_SKLEARN_AVAILABLE),
            "semanticError": str(self._semantic_error or ""),
        }


def get_ml_recommender() -> MLRecommender:
    return MLRecommender()


def get_ml_runtime_status() -> Dict[str, Any]:
    """Expose ML runtime availability for API/UI warnings."""
    try:
        return get_ml_recommender().runtime_status()
    except Exception:
        return {
            "available": False,
            "mode": "unavailable",
            "reason": "runtime_error",
            "message": "Machine Learning unavailable",
        }

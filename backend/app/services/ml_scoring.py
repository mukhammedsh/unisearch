import json
import re
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
        """Build TF-IDF text features from program names, location, and optional metadata.

        We include normalized aliases (e.g. "gamedev" -> "game development")
        to improve matching between short user queries and university metadata.
        """
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
            normalized = _normalize_ml_text(soup, for_query=False)
            docs.append(" ".join(part for part in (soup, normalized) if part).strip() or "university")
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

    def is_ready(self) -> bool:
        """Return True when sklearn is available and TF-IDF matrix is initialized."""
        self._ensure_fresh()
        return bool(
            _SKLEARN_AVAILABLE
            and self._vectorizer is not None
            and self._tfidf_matrix is not None
            and len([uid for uid in self._university_ids if uid]) > 0
        )

    def predict_relevance(self, user_interests: str) -> Dict[str, float]:
        """Match user interests to universities via cosine similarity of TF-IDF vectors.

        TF-IDF is fit over university metadata text at startup. During prediction
        we normalize short forms and abbreviations in user queries before vectorization.
        """
        self._ensure_fresh()
        query_raw = _safe_text(user_interests)
        query = _normalize_ml_text(query_raw, for_query=True) or query_raw

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


def get_ml_runtime_status() -> Dict[str, Any]:
    """Expose ML runtime availability for API/UI warnings."""
    if not _SKLEARN_AVAILABLE:
        return {
            "available": False,
            "reason": "dependency_missing",
            "message": "Machine Learning unavailable",
        }

    try:
        recommender = get_ml_recommender()
        if recommender.is_ready():
            return {"available": True, "reason": "ready", "message": ""}
        return {
            "available": False,
            "reason": "model_not_ready",
            "message": "Machine Learning unavailable",
        }
    except Exception:
        return {
            "available": False,
            "reason": "runtime_error",
            "message": "Machine Learning unavailable",
        }

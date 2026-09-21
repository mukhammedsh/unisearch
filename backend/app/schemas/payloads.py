import re
from typing import Any, Dict, List, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, Field, StrictInt, field_validator, model_validator


MAX_LIST_ITEMS = 50
MAX_DETAILS_KEYS = 32
MAX_DETAILS_DEPTH = 6
MAX_DETAILS_STRING_LEN = 2048
MAX_KEY_LEN = 128
MAX_SELECTED_ADMISSION_CHOICES = 100
MAX_SELECTED_CHOICE_KEYS = 16


def _strip_or_none(value: Any) -> Optional[str]:
    if value is None:
        return None
    out = str(value).strip()
    return out or None


def _strip_or_empty(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _bounded_dict(value: Any, *, max_keys: int, max_depth: int, field_name: str) -> Dict[str, Any]:
    if not isinstance(value, dict):
        return {}

    def visit(node: Any, depth: int) -> None:
        if depth > max_depth:
            raise ValueError(f"{field_name} is too deeply nested")
        if isinstance(node, dict):
            if len(node) > max_keys:
                raise ValueError(f"{field_name} has too many keys")
            for key, item in node.items():
                if not isinstance(key, str) or len(key) > MAX_KEY_LEN:
                    raise ValueError(f"{field_name} contains an invalid or overly long key")
                visit(item, depth + 1)
        elif isinstance(node, list):
            if len(node) > MAX_LIST_ITEMS:
                raise ValueError(f"{field_name} has too many list items")
            for item in node:
                visit(item, depth + 1)
        elif isinstance(node, str):
            if len(node) > MAX_DETAILS_STRING_LEN:
                raise ValueError(f"{field_name} contains string exceeding maximum allowed length")
        elif not isinstance(node, (int, float, bool, type(None))):
            raise ValueError(f"{field_name} contains an unsupported value type")

    visit(value, 1)
    return value


class ProfileExamInput(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: Optional[str] = Field(default=None, max_length=64)
    exam: Optional[str] = Field(default=None, max_length=64)
    score: Optional[float] = Field(default=None, ge=0, le=10000)
    raw_value: Optional[str] = Field(default=None, max_length=128)
    display_value: Optional[str] = Field(default=None, max_length=128)
    details: Optional[Dict[str, Any]] = None

    @field_validator("id", "exam", "raw_value", "display_value", mode="before")
    @classmethod
    def _validate_exam_keys(cls, value: Any) -> Optional[str]:
        return _strip_or_none(value)

    @field_validator("details", mode="before")
    @classmethod
    def _validate_details(cls, value: Any) -> Dict[str, Any]:
        return _bounded_dict(value, max_keys=MAX_DETAILS_KEYS, max_depth=MAX_DETAILS_DEPTH, field_name="details")

    @model_validator(mode="after")
    def _ensure_exam_id(self) -> "ProfileExamInput":
        if not self.id and not self.exam:
            raise ValueError("Each exam entry must include 'id' or 'exam'")
        if self.score is None and not self.raw_value and not self.details:
            raise ValueError("Each exam entry must include 'score', 'raw_value', or 'details'")
        return self


class ProfileLanguageInput(BaseModel):
    model_config = ConfigDict(extra="ignore")

    code: Optional[str] = Field(default=None, max_length=16)
    kind: Literal["native", "cefr", "exam"]
    level: Optional[int] = Field(default=None, ge=1, le=6)
    exam: Optional[str] = Field(default=None, max_length=64)
    score: Optional[float] = Field(default=None, ge=0, le=10000)
    raw_value: Optional[str] = Field(default=None, max_length=128)
    display_value: Optional[str] = Field(default=None, max_length=128)
    details: Optional[Dict[str, Any]] = None

    @field_validator("code", "exam", "raw_value", "display_value", mode="before")
    @classmethod
    def _validate_lang_fields(cls, value: Any) -> Optional[str]:
        return _strip_or_none(value)

    @field_validator("details", mode="before")
    @classmethod
    def _validate_details(cls, value: Any) -> Dict[str, Any]:
        return _bounded_dict(value, max_keys=MAX_DETAILS_KEYS, max_depth=MAX_DETAILS_DEPTH, field_name="details")

    @model_validator(mode="after")
    def _ensure_language_shape(self) -> "ProfileLanguageInput":
        if not self.code:
            raise ValueError("Each language entry must include 'code'")
        if self.kind == "cefr" and self.level is None:
            raise ValueError("Language kind='cefr' requires 'level'")
        if self.kind == "exam":
            if not self.exam:
                raise ValueError("Language kind='exam' requires 'exam'")
            if self.score is None and not self.raw_value and not self.details:
                raise ValueError("Language kind='exam' requires 'score', 'raw_value', or 'details'")
        return self


class ProfilePayload(BaseModel):
    model_config = ConfigDict(extra="ignore")

    budget: Optional[StrictInt] = Field(default=None, ge=0, le=1_000_000)
    gpa: Optional[float] = Field(default=None, ge=0, le=5.0)
    gpa_scale: Optional[float] = Field(default=None, ge=1.0, le=5.0)
    major: str = Field(default="", max_length=120)
    interests: Optional[str] = Field(default=None, max_length=1200)
    locale: Optional[str] = Field(default=None, max_length=16)
    studyMode: str = Field(default="", max_length=40)
    fundingType: str = Field(default="", max_length=20)
    selectedAdmissionChoices: Dict[str, Dict[str, str]] = Field(default_factory=dict)
    exams: List[ProfileExamInput] = Field(default_factory=list, max_length=MAX_LIST_ITEMS)
    languages: List[ProfileLanguageInput] = Field(default_factory=list, max_length=MAX_LIST_ITEMS)

    @field_validator("major", "studyMode", "fundingType", mode="before")
    @classmethod
    def _normalize_text_fields(cls, value: Any) -> str:
        return _strip_or_empty(value)

    @field_validator("interests", "locale", mode="before")
    @classmethod
    def _normalize_optional_text(cls, value: Any) -> Optional[str]:
        return _strip_or_none(value)

    @field_validator("selectedAdmissionChoices", mode="before")
    @classmethod
    def _normalize_selected_choices(cls, value: Any) -> Dict[str, Dict[str, str]]:
        if not isinstance(value, dict):
            return {}
        if len(value) > MAX_SELECTED_ADMISSION_CHOICES:
            raise ValueError("selectedAdmissionChoices has too many entries")
        out: Dict[str, Dict[str, str]] = {}
        for uni_id, selection in value.items():
            uni = _strip_or_none(uni_id)
            if not uni or not isinstance(selection, dict):
                continue
            if len(uni) > 64 or not re.match(r"^[a-zA-Z0-9_-]+$", uni):
                raise ValueError(f"Invalid university ID in selectedAdmissionChoices: {uni[:32]}")
            if len(selection) > MAX_SELECTED_CHOICE_KEYS:
                raise ValueError("selectedAdmissionChoices entry has too many keys")
            choice = _strip_or_none(selection.get("choiceKey"))
            if choice:
                if len(choice) > 128:
                    raise ValueError("choiceKey exceeds maximum allowed length (128 chars)")
                out[uni] = {
                    "programId": _strip_or_empty(selection.get("programId"))[:128],
                    "programName": _strip_or_empty(selection.get("programName"))[:200],
                    "categoryId": _strip_or_empty(selection.get("categoryId"))[:128],
                    "requirementProfileId": _strip_or_empty(selection.get("requirementProfileId"))[:128],
                    "fundingOptionId": _strip_or_empty(selection.get("fundingOptionId"))[:128],
                    "choiceKey": choice,
                }
        return out


class UniversitiesAiSortRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    profile: ProfilePayload = Field(default_factory=ProfilePayload)
    lang: Optional[str] = Field(default=None, max_length=16)
    q: Optional[str] = Field(default=None, max_length=200)
    country: Optional[str] = Field(default=None, max_length=80)
    city: Optional[str] = Field(default=None, max_length=80)
    region: Optional[str] = Field(default=None, max_length=80)
    major: Optional[str] = Field(default=None, max_length=120)
    study_level: Optional[str] = Field(default=None, max_length=40)
    funding_type: Optional[str] = Field(default=None, max_length=20)
    format: Optional[str] = Field(default=None, max_length=32)
    min_tuition: Optional[float] = Field(default=None, ge=0, le=1_000_000)
    max_tuition: Optional[float] = Field(default=None, ge=0, le=1_000_000)
    min_acceptance: Optional[float] = Field(default=None, ge=0, le=100)
    max_acceptance: Optional[float] = Field(default=None, ge=0, le=100)
    size: Optional[str] = Field(default=None, max_length=40)
    practice_vs_science: int = Field(default=50, ge=0, le=100)
    social_vs_hardcore: int = Field(default=50, ge=0, le=100)
    budget_vs_prestige: int = Field(default=50, ge=0, le=100)
    city_vs_campus: int = Field(default=50, ge=0, le=100)
    ai_balance: int = Field(default=50, ge=0, le=100)
    admission_bias: int = Field(default=50, ge=0, le=100)
    page: int = Field(default=1, ge=1, le=10_000)
    limit: int = Field(default=200, ge=1, le=2000)

    @field_validator(
        "q",
        "lang",
        "country",
        "city",
        "region",
        "major",
        "study_level",
        "funding_type",
        "format",
        "size",
        mode="before",
    )
    @classmethod
    def _normalize_optional_text(cls, value: Any) -> Optional[str]:
        return _strip_or_none(value)


class ProfileOnlyRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    profile: ProfilePayload = Field(default_factory=ProfilePayload)


class CompareProfilesRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    university_ids: List[str] = Field(..., max_length=MAX_LIST_ITEMS)
    profile: ProfilePayload = Field(default_factory=ProfilePayload)

    @field_validator("university_ids", mode="before")
    @classmethod
    def _normalize_university_ids(cls, value: Any) -> List[str]:
        if not isinstance(value, list):
            return value
        out: List[str] = []
        seen = set()
        for item in value:
            uni_id = _strip_or_none(item)
            if not uni_id:
                continue
            if len(uni_id) > 64 or not re.match(r"^[a-zA-Z0-9_-]+$", uni_id):
                raise ValueError(f"Invalid university ID format: {uni_id[:32]}")
            if uni_id in seen:
                continue
            seen.add(uni_id)
            out.append(uni_id)
        return out


class ExamValidateRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    exam: str = Field(min_length=1, max_length=64)
    score: Optional[Union[float, int, str]] = None
    raw_value: Optional[str] = Field(default=None, max_length=128)
    details: Optional[Dict[str, Any]] = None

    @field_validator("score", mode="before")
    @classmethod
    def _validate_score(cls, value: Any) -> Any:
        if value is None:
            return None
        if isinstance(value, str):
            val = _strip_or_none(value)
            if val is not None and len(val) > 128:
                raise ValueError("score text exceeds maximum allowed length (128 chars)")
            return val
        if isinstance(value, (int, float)):
            if value < -10000 or value > 100000:
                raise ValueError("numeric score is out of range")
            return value
        raise ValueError("score must be a number or string")

    @field_validator("exam", "raw_value", mode="before")
    @classmethod
    def _normalize_exam(cls, value: Any) -> Optional[str]:
        if value is None:
            return None
        out = _strip_or_empty(value)
        if not out:
            return None
        return out

    @field_validator("details", mode="before")
    @classmethod
    def _validate_details(cls, value: Any) -> Dict[str, Any]:
        return _bounded_dict(value, max_keys=MAX_DETAILS_KEYS, max_depth=MAX_DETAILS_DEPTH, field_name="details")

    @model_validator(mode="after")
    def _ensure_exam_validate_shape(self) -> "ExamValidateRequest":
        if not self.exam:
            raise ValueError("exam is required")
        if self.score is None and not self.raw_value and not self.details:
            raise ValueError("score, raw_value, or details is required")
        return self


class LanguageValidateRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    code: str = Field(min_length=1, max_length=16)
    kind: Literal["native", "cefr", "exam"]
    level: Optional[int] = Field(default=None, ge=1, le=6)
    label: Optional[str] = Field(default=None, max_length=8)
    exam: Optional[str] = Field(default=None, max_length=64)
    score: Optional[Union[float, int, str]] = None
    raw_value: Optional[str] = Field(default=None, max_length=128)
    details: Optional[Dict[str, Any]] = None

    @field_validator("score", mode="before")
    @classmethod
    def _validate_score(cls, value: Any) -> Any:
        if value is None:
            return None
        if isinstance(value, str):
            val = _strip_or_none(value)
            if val is not None and len(val) > 128:
                raise ValueError("score text exceeds maximum allowed length (128 chars)")
            return val
        if isinstance(value, (int, float)):
            if value < 0 or value > 10000:
                raise ValueError("numeric score is out of range")
            return value
        raise ValueError("score must be a number or string")

    @field_validator("code", "exam", "label", "raw_value", mode="before")
    @classmethod
    def _normalize_language_fields(cls, value: Any) -> Optional[str]:
        return _strip_or_none(value)

    @field_validator("details", mode="before")
    @classmethod
    def _validate_details(cls, value: Any) -> Dict[str, Any]:
        return _bounded_dict(value, max_keys=MAX_DETAILS_KEYS, max_depth=MAX_DETAILS_DEPTH, field_name="details")

    @model_validator(mode="after")
    def _ensure_language_validation_shape(self) -> "LanguageValidateRequest":
        if self.kind == "cefr" and self.level is None and not self.label:
            raise ValueError("kind='cefr' requires level or label")
        if self.kind == "exam":
            if not self.exam:
                raise ValueError("kind='exam' requires exam")
            if self.score is None and not self.raw_value and not self.details:
                raise ValueError("kind='exam' requires score, raw_value, or details")
        return self


def to_profile_dict(profile: ProfilePayload) -> Dict[str, Any]:
    return profile.model_dump(exclude_none=True)

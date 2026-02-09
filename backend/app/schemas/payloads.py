from typing import Any, Dict, List, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


MAX_LIST_ITEMS = 50


def _strip_or_none(value: Any) -> Optional[str]:
    if value is None:
        return None
    out = str(value).strip()
    return out or None


def _strip_or_empty(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


class ProfileExamInput(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: Optional[str] = Field(default=None, max_length=64)
    exam: Optional[str] = Field(default=None, max_length=64)
    score: float = Field(ge=0, le=10000)

    @field_validator("id", "exam", mode="before")
    @classmethod
    def _validate_exam_keys(cls, value: Any) -> Optional[str]:
        return _strip_or_none(value)

    @model_validator(mode="after")
    def _ensure_exam_id(self) -> "ProfileExamInput":
        if not self.id and not self.exam:
            raise ValueError("Each exam entry must include 'id' or 'exam'")
        return self


class ProfileLanguageInput(BaseModel):
    model_config = ConfigDict(extra="ignore")

    code: Optional[str] = Field(default=None, max_length=16)
    lang: Optional[str] = Field(default=None, max_length=16)
    kind: Literal["native", "cefr", "exam"]
    level: Optional[int] = Field(default=None, ge=1, le=6)
    exam: Optional[str] = Field(default=None, max_length=64)
    examId: Optional[str] = Field(default=None, max_length=64)
    score: Optional[float] = Field(default=None, ge=0, le=10000)

    @field_validator("code", "lang", "exam", "examId", mode="before")
    @classmethod
    def _validate_lang_fields(cls, value: Any) -> Optional[str]:
        return _strip_or_none(value)

    @model_validator(mode="after")
    def _ensure_language_shape(self) -> "ProfileLanguageInput":
        if not self.code and not self.lang:
            raise ValueError("Each language entry must include 'code' or 'lang'")
        if self.kind == "cefr" and self.level is None:
            raise ValueError("Language kind='cefr' requires 'level'")
        if self.kind == "exam":
            if not self.exam and not self.examId:
                raise ValueError("Language kind='exam' requires 'exam' or 'examId'")
            if self.score is None:
                raise ValueError("Language kind='exam' requires 'score'")
        return self


class ProfilePayload(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str = Field(default="", max_length=64)
    budget: Optional[float] = Field(default=None, ge=0, le=1_000_000)
    gpa: Optional[float] = Field(default=None, ge=0, le=100)
    major: str = Field(default="", max_length=120)
    interests: Optional[str] = Field(default=None, max_length=1200)
    studyMode: str = Field(default="", max_length=40)
    fundingType: str = Field(default="", max_length=20)
    exams: List[ProfileExamInput] = Field(default_factory=list, max_length=MAX_LIST_ITEMS)
    languages: List[ProfileLanguageInput] = Field(default_factory=list, max_length=MAX_LIST_ITEMS)

    @field_validator("name", "major", "studyMode", "fundingType", mode="before")
    @classmethod
    def _normalize_text_fields(cls, value: Any) -> str:
        return _strip_or_empty(value)

    @field_validator("interests", mode="before")
    @classmethod
    def _normalize_optional_interests(cls, value: Any) -> Optional[str]:
        return _strip_or_none(value)


class UniversitiesAiSortRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    profile: ProfilePayload = Field(default_factory=ProfilePayload)
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
    ai_balance: int = Field(default=50, ge=0, le=100)
    page: int = Field(default=1, ge=1)
    limit: int = Field(default=200, ge=1, le=2000)

    @field_validator(
        "q",
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


class MentorAskRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    question: str = Field(min_length=1, max_length=1200)
    university_id: str = Field(default="", max_length=128)
    online: bool = True
    profile: ProfilePayload = Field(default_factory=ProfilePayload)
    mode: Literal["auto", "gemini", "fallback", "local"] = "auto"

    @field_validator("question", mode="before")
    @classmethod
    def _normalize_question(cls, value: Any) -> str:
        out = _strip_or_empty(value)
        if not out:
            raise ValueError("question is required")
        return out

    @field_validator("university_id", mode="before")
    @classmethod
    def _normalize_university_id(cls, value: Any) -> str:
        return _strip_or_empty(value)


class ExamValidateRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    exam: str = Field(min_length=1, max_length=64)
    score: Union[float, int, str]

    @field_validator("exam", mode="before")
    @classmethod
    def _normalize_exam(cls, value: Any) -> str:
        out = _strip_or_empty(value)
        if not out:
            raise ValueError("exam is required")
        return out


class LanguageValidateRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    code: str = Field(min_length=1, max_length=16)
    kind: Literal["native", "cefr", "exam"]
    level: Optional[int] = Field(default=None, ge=1, le=6)
    label: Optional[str] = Field(default=None, max_length=8)
    exam: Optional[str] = Field(default=None, max_length=64)
    score: Optional[Union[float, int, str]] = None

    @field_validator("code", "exam", "label", mode="before")
    @classmethod
    def _normalize_language_fields(cls, value: Any) -> Optional[str]:
        return _strip_or_none(value)

    @model_validator(mode="after")
    def _ensure_language_validation_shape(self) -> "LanguageValidateRequest":
        if self.kind == "cefr" and self.level is None and not self.label:
            raise ValueError("kind='cefr' requires level or label")
        if self.kind == "exam":
            if not self.exam:
                raise ValueError("kind='exam' requires exam")
            if self.score is None or self.score == "":
                raise ValueError("kind='exam' requires score")
        return self


def to_profile_dict(profile: ProfilePayload) -> Dict[str, Any]:
    return profile.model_dump(exclude_none=True)

"""Validated request models for the accepted admissions catalog endpoints."""

from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.payloads import ProfilePayload


_STUDY_LEVEL_ALIASES = {
    "bachelor": "undergraduate",
    "bachelor's": "undergraduate",
    "master": "masters",
    "master's": "masters",
    "doctorate": "doctoral",
    "phd": "doctoral",
    "postgraduate_taught": "masters",
    "professional graduate": "professional",
}
_STUDY_LEVELS = {"undergraduate", "masters", "doctoral", "professional", "graduate", "mba"}


class AdmissionContextInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    study_option_id: Optional[str] = Field(default=None, max_length=128)
    application_route_id: Optional[str] = Field(default=None, max_length=256)
    study_level: Optional[str] = Field(default=None, max_length=40)
    applicant_route: Optional[Literal["first_year", "transfer", "graduate"]] = None
    intended_entry_cycle: Optional[str] = Field(default=None, max_length=40)
    fee_status_context: Optional[Literal[
        "unknown", "self_reported_home_domestic", "self_reported_international_overseas", "other"
    ]] = None

    @field_validator("study_option_id", "application_route_id", "intended_entry_cycle", mode="before")
    @classmethod
    def _strip_optional_text(cls, value):
        if value is None:
            return None
        text = str(value).strip()
        return text or None

    @field_validator("study_level", mode="before")
    @classmethod
    def _normalize_study_level(cls, value):
        if value is None:
            return None
        level = str(value).strip().lower()
        if not level:
            return None
        level = _STUDY_LEVEL_ALIASES.get(level, level)
        if level not in _STUDY_LEVELS:
            raise ValueError("study_level must be a canonical admissions level or supported alias")
        return level

    @field_validator("fee_status_context", mode="before")
    @classmethod
    def _normalize_fee_status(cls, value):
        return str(value).strip().lower() if value is not None else None


class AdmissionsContextRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    profile: ProfilePayload = Field(default_factory=ProfilePayload)
    context: AdmissionContextInput = Field(default_factory=AdmissionContextInput)

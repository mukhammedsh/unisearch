"""Typed, self-reported evidence fields used by scoped admissions contexts."""

from __future__ import annotations

import math
from datetime import date
from typing import Annotated, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


def validate_admission_date(value: object, *, allow_future: bool = False) -> Optional[str]:
    """Validate an ISO calendar date and preserve its string representation."""
    if value is None or value == "":
        return None
    if not isinstance(value, str):
        raise ValueError("date must use YYYY-MM-DD format")
    try:
        parsed = date.fromisoformat(value)
    except ValueError as error:
        raise ValueError("date must use YYYY-MM-DD format") from error
    if parsed.isoformat() != value:
        raise ValueError("date must use YYYY-MM-DD format")
    if not allow_future and parsed > date.today():
        raise ValueError("date cannot be in the future")
    return value


class EvidenceModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class LanguageEvidence(EvidenceModel):
    kind: Literal["primary_language", "education", "employment"]
    language: str = Field(min_length=2, max_length=16, pattern=r"^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$")
    country: Optional[str] = Field(default=None, max_length=80)
    qualification_level: Optional[Literal["secondary", "bachelor", "master", "doctorate", "professional", "other"]] = None
    started_on: Optional[str] = Field(default=None, max_length=10)
    completed_on: Optional[str] = Field(default=None, max_length=10)
    status: Literal["completed", "in_progress", "unknown"] = "unknown"
    entirely_in_language: Optional[bool] = None

    @field_validator("country", mode="before")
    @classmethod
    def normalize_country(cls, value):
        return value.strip() or None if isinstance(value, str) else value

    @field_validator("started_on", "completed_on", mode="before")
    @classmethod
    def validate_dates(cls, value):
        return validate_admission_date(value)

    @model_validator(mode="after")
    def validate_interval(self):
        if self.started_on and self.completed_on and self.started_on > self.completed_on:
            raise ValueError("started_on must be on or before completed_on")
        return self


class InstitutionalEvidence(EvidenceModel):
    university_id: str = Field(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")


class EnrollmentEvidence(InstitutionalEvidence):
    kind: Literal["enrollment"]
    program_id: Optional[str] = Field(default=None, max_length=128)
    status: Literal["enrolled", "on_leave", "completed", "not_enrolled", "unknown"] = "unknown"
    units: Optional[int] = Field(default=None, ge=0, le=10000)
    major_units: Optional[int] = Field(default=None, ge=0, le=10000)
    completed_major_subjects: Optional[int] = Field(default=None, ge=0, le=1000)
    expected_completion_on: Optional[str] = Field(default=None, max_length=10)

    @field_validator("expected_completion_on", mode="before")
    @classmethod
    def validate_completion_date(cls, value):
        return validate_admission_date(value, allow_future=True)


class GpaEvidence(InstitutionalEvidence):
    kind: Literal["gpa"]
    program_id: Optional[str] = Field(default=None, max_length=128)
    metric: Literal["overall", "technical", "major"]
    value: float = Field(ge=0, le=5)
    scale: float = Field(ge=1, le=5)
    as_of_term: Optional[str] = Field(default=None, max_length=40)

    @field_validator("value", "scale", mode="before")
    @classmethod
    def validate_finite_number(cls, value):
        if isinstance(value, bool):
            raise ValueError("GPA values must be finite numbers")
        try:
            if not math.isfinite(float(value)):
                raise ValueError("GPA values must be finite numbers")
        except (TypeError, ValueError) as error:
            raise ValueError("GPA values must be finite numbers") from error
        return value

    @model_validator(mode="after")
    def value_within_scale(self):
        if self.value > self.scale:
            raise ValueError("GPA value cannot exceed its scale")
        return self


class CredentialEvidence(InstitutionalEvidence):
    kind: Literal["credential"]
    credential_id: str = Field(min_length=1, max_length=128)
    status: Literal["completed", "in_progress", "not_completed", "unknown"] = "unknown"
    completed_on: Optional[str] = Field(default=None, max_length=10)
    score_percent: Optional[float] = Field(default=None, ge=0, le=100)

    @field_validator("completed_on", mode="before")
    @classmethod
    def validate_completed_date(cls, value):
        return validate_admission_date(value)

    @field_validator("score_percent", mode="before")
    @classmethod
    def validate_score_percent(cls, value):
        if value is None:
            return None
        if isinstance(value, bool):
            raise ValueError("score_percent must be a finite number")
        try:
            if not math.isfinite(float(value)):
                raise ValueError("score_percent must be a finite number")
        except (TypeError, ValueError) as error:
            raise ValueError("score_percent must be a finite number") from error
        return value


InstitutionalEvidenceInput = Annotated[
    Union[EnrollmentEvidence, GpaEvidence, CredentialEvidence],
    Field(discriminator="kind"),
]

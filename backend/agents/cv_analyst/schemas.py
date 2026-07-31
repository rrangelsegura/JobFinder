"""Structured extraction schema for the CV Analyst agent.

Mirrors the Candidate/Education/WorkExperience/Skill/Language/Certification
fields in docs/data-model.md §2.1. Per docs/backend-standards.md's "Structured
Output" standard, all LLM output must validate against this schema before
being trusted.
"""

import re
from datetime import date, datetime
from enum import Enum
from typing import Any, Optional

from dateutil import parser as dateutil_parser
from pydantic import BaseModel, EmailStr, Field, field_validator

# Real CVs (and LLMs transcribing them) say "present"/"current"/"ongoing" for
# an end date that hasn't happened yet — found via manual end-to-end testing
# against a live LLM, where the model faithfully copied "present" from the
# resume text and a plain `Optional[date]` field rejected it outright.
ONGOING_END_DATE_TOKENS = {"present", "current", "currently", "ongoing", "now", "n/a", "-"}

# cv-upload-hardening: found via a real 5-page CV — dates given as
# "month year" in the source (e.g. "Feb 2024") come back from the LLM as
# "YYYY-MM", which a Pydantic `date` field rejects outright as "too short".
# Default the missing day to the 1st, same spirit as normalizing "present".
_YEAR_MONTH_PATTERN = re.compile(r"^\d{4}-\d{2}$")
_YEAR_ONLY_PATTERN = re.compile(r"^\d{4}$")

# The same real CV also produced "Month YYYY" dates (e.g. "Jun 2021"),
# mixing English and Spanish month abbreviations to match how the source CV
# itself writes them ("Dic 2022", "Ene 2020"). dateutil only recognizes
# English month names, so Spanish ones are translated first.
_SPANISH_MONTH_ALIASES = {
    "ene": "Jan",
    "feb": "Feb",
    "mar": "Mar",
    "abr": "Apr",
    "may": "May",
    "jun": "Jun",
    "jul": "Jul",
    "ago": "Aug",
    "sept": "Sep",
    "sep": "Sep",
    "oct": "Oct",
    "nov": "Nov",
    "dic": "Dec",
}
_SPANISH_MONTH_PATTERN = re.compile(
    r"\b(" + "|".join(_SPANISH_MONTH_ALIASES) + r")\b", re.IGNORECASE
)


def _normalize_ongoing_date(value: Any) -> Any:
    if isinstance(value, str) and value.strip().lower() in ONGOING_END_DATE_TOKENS:
        return None
    return value


def _normalize_partial_date(value: Any) -> Any:
    if not isinstance(value, str):
        return value

    stripped = value.strip()
    if _YEAR_MONTH_PATTERN.match(stripped):
        return f"{stripped}-01"
    if _YEAR_ONLY_PATTERN.match(stripped):
        return f"{stripped}-01-01"

    # Fuzzy fallback for "Month YYYY" style dates (English or Spanish
    # abbreviations). Only used once the strict patterns above don't match,
    # and only its result is trusted — genuinely invalid input still fails
    # Pydantic's own date validation afterward.
    translated = _SPANISH_MONTH_PATTERN.sub(
        lambda m: _SPANISH_MONTH_ALIASES[m.group(1).lower()], stripped
    )
    try:
        parsed = dateutil_parser.parse(translated, default=datetime(1900, 1, 1))
    except (ValueError, OverflowError):
        return value
    return parsed.date().isoformat()


def _normalize_date_value(value: Any) -> Any:
    return _normalize_partial_date(_normalize_ongoing_date(value))


class SkillType(str, Enum):
    technical = "technical"
    soft = "soft"


class PersonalInfo(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    phone: Optional[str] = None
    address: Optional[str] = None


class EducationEntry(BaseModel):
    institution: str
    title: str
    start_date: date
    end_date: Optional[date] = None

    _normalize_dates = field_validator("start_date", "end_date", mode="before")(_normalize_date_value)


class WorkExperienceEntry(BaseModel):
    company: str
    position: str
    description: Optional[str] = None
    start_date: date
    end_date: Optional[date] = None

    _normalize_dates = field_validator("start_date", "end_date", mode="before")(_normalize_date_value)


class SkillEntry(BaseModel):
    name: str
    type: SkillType


class LanguageEntry(BaseModel):
    name: str
    proficiency: Optional[str] = None


class CertificationEntry(BaseModel):
    name: str
    issuer: Optional[str] = None
    issue_date: Optional[date] = None

    _normalize_issue_date = field_validator("issue_date", mode="before")(_normalize_date_value)


class CvExtractionResult(BaseModel):
    """The complete structured output the CV Analyst agent must produce.

    personal_info/education/work_experience are expected on every successfully
    processed CV (spec: "Extracted Field Coverage"). skills/languages/
    certifications default to empty lists — a CV missing those sections still
    succeeds (spec: "CV missing optional field groups still succeeds").
    """

    personal_info: PersonalInfo
    education: list[EducationEntry] = Field(default_factory=list)
    work_experience: list[WorkExperienceEntry] = Field(default_factory=list)
    skills: list[SkillEntry] = Field(default_factory=list)
    languages: list[LanguageEntry] = Field(default_factory=list)
    certifications: list[CertificationEntry] = Field(default_factory=list)

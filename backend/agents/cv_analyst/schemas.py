"""Structured extraction schema for the CV Analyst agent.

Mirrors the Candidate/Education/WorkExperience/Skill/Language/Certification
fields in docs/data-model.md §2.1. Per docs/backend-standards.md's "Structured
Output" standard, all LLM output must validate against this schema before
being trusted.
"""

from datetime import date
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

# Real CVs (and LLMs transcribing them) say "present"/"current"/"ongoing" for
# an end date that hasn't happened yet — found via manual end-to-end testing
# against a live LLM, where the model faithfully copied "present" from the
# resume text and a plain `Optional[date]` field rejected it outright.
ONGOING_END_DATE_TOKENS = {"present", "current", "currently", "ongoing", "now", "n/a", "-"}


def _normalize_ongoing_date(value: Any) -> Any:
    if isinstance(value, str) and value.strip().lower() in ONGOING_END_DATE_TOKENS:
        return None
    return value


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

    _normalize_end_date = field_validator("end_date", mode="before")(_normalize_ongoing_date)


class WorkExperienceEntry(BaseModel):
    company: str
    position: str
    description: Optional[str] = None
    start_date: date
    end_date: Optional[date] = None

    _normalize_end_date = field_validator("end_date", mode="before")(_normalize_ongoing_date)


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

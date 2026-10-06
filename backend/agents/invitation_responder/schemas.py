"""Schemas for the invitation responder agent.

Per docs/backend-standards.md's "Structured Output" standard, all LLM output
that is parsed as data (the extraction step) must validate against these
schemas before being trusted. The drafting step returns plain prose, so only
its envelope is typed.
"""

import re
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator

MAX_INVITATION_TEXT_CHARS = 5000

_LANGUAGE_CODE_PATTERN = re.compile(r"^[a-z]{2,3}(-[a-z]{2,4})?$")


class InvitationIntent(str, Enum):
    INTERESTED = "interested"
    REQUEST_MORE_INFO = "request_more_info"
    DECLINE = "decline"


def _blank_to_none(value: Any) -> Any:
    if isinstance(value, str) and not value.strip():
        return None
    return value


class InvitationExtraction(BaseModel):
    """What the recruiter's message says. Absent information stays None —
    never invented."""

    recruiter_name: Optional[str] = None
    recruiter_title: Optional[str] = None
    company: Optional[str] = None
    role_title: Optional[str] = None
    location: Optional[str] = None
    language: str
    call_to_action: Optional[str] = None

    @field_validator(
        "recruiter_name",
        "recruiter_title",
        "company",
        "role_title",
        "location",
        "call_to_action",
        mode="before",
    )
    @classmethod
    def _blank_strings_are_missing(cls, value: Any) -> Any:
        return _blank_to_none(value)

    @field_validator("language", mode="before")
    @classmethod
    def _normalize_language_code(cls, value: Any) -> Any:
        if not isinstance(value, str):
            return value
        code = value.strip().lower()
        if not _LANGUAGE_CODE_PATTERN.match(code):
            raise ValueError("language must be an ISO language code such as 'en' or 'es'")
        return code


class CandidateSummary(BaseModel):
    """Bounded summary of the candidate profile used to ground the reply —
    deliberately not the full profile, to protect the model's context budget."""

    full_name: str
    current_title: Optional[str] = None
    current_company: Optional[str] = None
    previous_companies: list[str] = Field(default_factory=list)
    top_skills: list[str] = Field(default_factory=list)


class ExtractionRequest(BaseModel):
    invitation_text: str = Field(min_length=1, max_length=MAX_INVITATION_TEXT_CHARS)

    @field_validator("invitation_text")
    @classmethod
    def _must_not_be_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("invitation_text must not be blank")
        return value


class DraftRequest(ExtractionRequest):
    invitation: InvitationExtraction
    intent: InvitationIntent = InvitationIntent.INTERESTED
    candidate: CandidateSummary


class DraftResponse(BaseModel):
    draft_reply: str

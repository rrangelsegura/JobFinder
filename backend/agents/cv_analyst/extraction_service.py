"""LLM-driven structured extraction for the CV Analyst agent.

Per docs/backend-standards.md's hallucination-guardrail standard: local model
output must be validated against a Pydantic schema, with one retry using a
refined prompt on validation failure before giving up.
"""

import logging
import os

import httpx
from pydantic import ValidationError

from .schemas import (
    CertificationEntry,
    CvExtractionResult,
    EducationEntry,
    LanguageEntry,
    PersonalInfo,
    SkillEntry,
    SkillType,
    WorkExperienceEntry,
)

logger = logging.getLogger(__name__)

DEFAULT_MODEL = os.environ.get("OLLAMA_MODEL", "llama3:8b")
DEFAULT_BASE_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")

# A concrete example, not the raw Pydantic JSON schema, is what actually goes
# in the prompt. Found via manual end-to-end testing: llama3:8b nested
# `skills` entries as {"type": {"name": ..., "category": ...}} when only given
# the abstract JSON schema — "type" is both our field name and a reserved
# JSON-Schema keyword, and the model conflated the two. A worked example has
# no such ambiguity.
_EXAMPLE_RESULT = CvExtractionResult(
    personal_info=PersonalInfo(first_name="Jane", last_name="Doe", email="jane.doe@example.com", phone="612345678"),
    education=[EducationEntry(institution="MIT", title="Computer Science", start_date="2015-09-01", end_date="2019-06-01")],
    work_experience=[
        WorkExperienceEntry(
            company="Acme Corp",
            position="Software Engineer",
            description="Built internal tools",
            start_date="2019-07-01",
            end_date=None,
        )
    ],
    skills=[SkillEntry(name="Python", type=SkillType.technical), SkillEntry(name="Communication", type=SkillType.soft)],
    languages=[LanguageEntry(name="English", proficiency="native")],
    certifications=[CertificationEntry(name="AWS Certified Developer", issuer="Amazon", issue_date="2021-03-01")],
)


class LlmSchemaValidationError(Exception):
    """Raised when the LLM's output still fails schema validation after one retry."""


def _call_ollama(prompt: str, model: str, base_url: str) -> str:
    response = httpx.post(
        f"{base_url}/api/generate",
        json={"model": model, "prompt": prompt, "format": "json", "stream": False},
        timeout=120.0,
    )
    response.raise_for_status()
    return response.json()["response"]


def _build_extraction_prompt(resume_text: str) -> str:
    example = _EXAMPLE_RESULT.model_dump_json(indent=2)
    return (
        "Extract the candidate's personal information, education, work "
        "experience, skills, languages, and certifications from the resume "
        "text below. Return ONLY JSON, with EXACTLY this flat structure "
        "(this is a worked example with placeholder data, not the real "
        "candidate — match its shape exactly, especially that each skill is "
        'a flat {"name": ..., "type": ...} object, not nested):\n\n'
        f"{example}\n\n"
        "Omit fields you cannot find; use empty lists for missing sections. "
        "For an ongoing education or job with no end date, omit end_date "
        "rather than writing 'present' or 'current'.\n\n"
        f"Resume text:\n{resume_text}"
    )


def _build_retry_prompt(resume_text: str, previous_output: str, error: ValidationError) -> str:
    example = _EXAMPLE_RESULT.model_dump_json(indent=2)
    return (
        "Your previous JSON output failed schema validation with these "
        f"errors:\n{error}\n\nPrevious output:\n{previous_output}\n\n"
        "Here is the exact flat structure required again, as a worked "
        f"example with placeholder data:\n\n{example}\n\n"
        "Fix the output and return ONLY corrected JSON matching that shape "
        f"exactly, for this resume text:\n{resume_text}"
    )


def extract_structured_data(
    resume_text: str,
    model: str = DEFAULT_MODEL,
    base_url: str = DEFAULT_BASE_URL,
) -> CvExtractionResult:
    """Extract structured candidate data from OCR'd resume text via the local LLM.

    Retries once with a refined prompt if the first attempt fails schema
    validation. Raises LlmSchemaValidationError if the retry also fails.
    """
    raw_output = _call_ollama(_build_extraction_prompt(resume_text), model, base_url)

    try:
        return CvExtractionResult.model_validate_json(raw_output)
    except ValidationError as first_error:
        logger.warning("LLM output failed schema validation, retrying once: %s", first_error)
        retry_prompt = _build_retry_prompt(resume_text, raw_output, first_error)
        retry_output = _call_ollama(retry_prompt, model, base_url)
        try:
            return CvExtractionResult.model_validate_json(retry_output)
        except ValidationError as second_error:
            logger.error("LLM output failed schema validation after retry: %s", second_error)
            raise LlmSchemaValidationError(
                f"LLM output failed schema validation after one retry: {second_error}"
            ) from second_error

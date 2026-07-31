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
#
# cv-upload-hardening: a real 5-page CV with 14 skills and 2 languages made
# the model revert to flat strings ('PL/pgSQL', 'Spanish (native)') instead
# of the required objects — the example previously showed only 2 skills and
# 1 language, not enough to demonstrate the pattern holding under repetition.
_EXAMPLE_RESULT = CvExtractionResult(
    personal_info=PersonalInfo(first_name="Jane", last_name="Doe", email="jane.doe@example.com", phone="612345678"),
    education=[
        EducationEntry(institution="MIT", title="Computer Science", start_date="2015-09-01", end_date="2019-06-01"),
        EducationEntry(institution="Coursera", title="Data Science Bootcamp", start_date="2020-02-01", end_date=None),
    ],
    work_experience=[
        WorkExperienceEntry(
            company="Acme Corp",
            position="Software Engineer",
            description="Built internal tools",
            start_date="2019-07-01",
            end_date=None,
        )
    ],
    skills=[
        SkillEntry(name="Python", type=SkillType.technical),
        SkillEntry(name="SQL", type=SkillType.technical),
        SkillEntry(name="AWS", type=SkillType.technical),
        SkillEntry(name="Communication", type=SkillType.soft),
    ],
    languages=[
        LanguageEntry(name="English", proficiency="native"),
        LanguageEntry(name="Spanish", proficiency="fluent"),
    ],
    certifications=[CertificationEntry(name="AWS Certified Developer", issuer="Amazon", issue_date="2021-03-01")],
)

# Ollama's own default (2048 tokens) is well below what llama3:8b actually
# supports. Observed for real: a large resume plus a retry prompt (which
# necessarily repeats the resume text) exceeded 2048 tokens and the model's
# output collapsed entirely (a required field went missing, not just
# malformed) rather than merely repeating its earlier mistake.
_NUM_CTX = 8192

# Retry prompts summarize at most this many distinct validation errors — a
# resume with many wrong-shape items (e.g. 20 flat-string skills) otherwise
# produces one error line per item, ballooning the retry prompt for no
# benefit (they're all the same mistake).
_MAX_RETRY_ERRORS_SHOWN = 5

# A real 5-page CV genuinely timed out at the previous 120s — num_ctx: 8192
# makes local CPU inference proportionally slower. Generous on purpose:
# local single-user inference, not a latency-sensitive API.
_OLLAMA_TIMEOUT_SECONDS = 300.0


class LlmSchemaValidationError(Exception):
    """Raised when the LLM's output still fails schema validation after one retry."""


def _call_ollama(prompt: str, model: str, base_url: str) -> str:
    response = httpx.post(
        f"{base_url}/api/generate",
        json={
            "model": model,
            "prompt": prompt,
            "format": "json",
            "stream": False,
            "options": {"num_ctx": _NUM_CTX},
        },
        timeout=_OLLAMA_TIMEOUT_SECONDS,
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
        'a flat {"name": ..., "type": ...} object, not nested). This applies '
        "regardless of how many items are in a list — even with many "
        "skills, languages, education entries, or jobs, every single one "
        "keeps the exact same field names and shape as the example (e.g. "
        'every education entry uses "institution"/"title", never "name"):\n\n'
        f"{example}\n\n"
        "Omit fields you cannot find; use empty lists for missing sections. "
        "For an ongoing education or job with no end date, omit end_date "
        "rather than writing 'present' or 'current'.\n\n"
        f"Resume text:\n{resume_text}"
    )


def _summarize_validation_errors(error: ValidationError, max_shown: int = _MAX_RETRY_ERRORS_SHOWN) -> str:
    """Dedupe by error type/location-shape so a resume with many wrong-shape
    items (e.g. 20 flat-string skills) produces one representative line per
    distinct mistake, not one line per item."""
    seen_kinds: dict[tuple[str, str], dict] = {}
    for err in error.errors():
        loc = err.get("loc", ())
        # collapse list indices (e.g. ("skills", 3) and ("skills", 7) are the
        # same kind of mistake) so they dedupe together
        loc_shape = tuple("#" if isinstance(part, int) else part for part in loc)
        kind = (str(loc_shape), err.get("type", ""))
        seen_kinds.setdefault(kind, err)

    lines = []
    for err in list(seen_kinds.values())[:max_shown]:
        loc = ".".join(str(part) for part in err.get("loc", ()))
        lines.append(f"{loc}: {err.get('msg', '')}")

    omitted = len(seen_kinds) - len(lines)
    if omitted > 0:
        lines.append(f"...and {omitted} more distinct issue(s) of the same kinds.")
    return "\n".join(lines)


def _build_retry_prompt(resume_text: str, error: ValidationError) -> str:
    example = _EXAMPLE_RESULT.model_dump_json(indent=2)
    error_summary = _summarize_validation_errors(error)
    return (
        "Your previous JSON output failed schema validation. Here is a "
        f"summary of what was wrong (not every occurrence, just the distinct "
        f"kinds of mistakes):\n{error_summary}\n\n"
        "Here is the exact flat structure required again, as a worked "
        f"example with placeholder data:\n\n{example}\n\n"
        "Fix those mistakes and return ONLY corrected JSON matching that "
        f"shape exactly, for this resume text:\n{resume_text}"
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
        retry_prompt = _build_retry_prompt(resume_text, first_error)
        retry_output = _call_ollama(retry_prompt, model, base_url)
        try:
            return CvExtractionResult.model_validate_json(retry_output)
        except ValidationError as second_error:
            logger.error("LLM output failed schema validation after retry: %s", second_error)
            raise LlmSchemaValidationError(
                f"LLM output failed schema validation after one retry: {second_error}"
            ) from second_error

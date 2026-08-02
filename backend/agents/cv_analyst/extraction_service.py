"""LLM-driven structured extraction for the CV Analyst agent.

Per docs/backend-standards.md's hallucination-guardrail standard: local model
output must be validated against a Pydantic schema, with one retry using a
refined prompt on validation failure before giving up.

cv-extraction-multi-call: extraction is now two call types, not one. A
"flat" call produces personal_info/education/work_experience (core fields
only)/skills/languages/certifications — the same shape this codebase ran
reliably before work-experience-detail. A "detail" call, one per work
experience entry, produces just that job's responsibilities/projects. This
split exists because a real CV with several detailed jobs made the combined
single-call output exceed llama3:8b's 8192-token context window (a hard
model ceiling, not a tunable value) — see work-experience-detail's manual
verification report. See design.md for the full rationale.
"""

import logging
import os
from datetime import date
from typing import Optional

import httpx
from pydantic import BaseModel, ValidationError

from .schemas import (
    CertificationEntry,
    CvExtractionFlatResult,
    CvExtractionResult,
    EducationEntry,
    FlatWorkExperienceEntry,
    LanguageEntry,
    PersonalInfo,
    ProjectEntry,
    SkillEntry,
    SkillType,
    WorkExperienceDetailResult,
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
#
# cv-extraction-multi-call: work_experience entries here use
# FlatWorkExperienceEntry, which has no responsibilities/projects fields at
# all (not just empty ones) — those come from a separate per-job detail call
# (_WORK_EXPERIENCE_DETAIL_EXAMPLE below). Showing even empty
# responsibilities/projects keys in this example was found, via real-CV
# verification, to still nudge the model toward inventing content for them;
# omitting the keys entirely from both the schema and the example fixes that.
_FLAT_EXAMPLE_RESULT = CvExtractionFlatResult(
    personal_info=PersonalInfo(first_name="Jane", last_name="Doe", email="jane.doe@example.com", phone="612345678"),
    education=[
        EducationEntry(institution="MIT", title="Computer Science", start_date="2015-09-01", end_date="2019-06-01"),
        EducationEntry(institution="Coursera", title="Data Science Bootcamp", start_date="2020-02-01", end_date=None),
    ],
    work_experience=[
        FlatWorkExperienceEntry(
            company="Acme Corp",
            position="Software Engineer",
            description="Built internal tools",
            start_date="2019-07-01",
            end_date=None,
        ),
        FlatWorkExperienceEntry(
            company="Globex Inc",
            position="Junior Developer",
            description="Maintained a legacy billing system",
            start_date="2017-06-01",
            end_date="2019-06-01",
        ),
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

# Worked example for the per-job detail call — same depth-under-repetition
# requirement as the flat example's skills/languages/education (2+ projects,
# 2+ achievements/stack items each), just scoped to one job's response
# instead of embedded inside a multi-job array.
_WORK_EXPERIENCE_DETAIL_EXAMPLE = WorkExperienceDetailResult(
    responsibilities=[
        "Led backend architecture for the internal tools team",
        "Mentored two junior engineers",
    ],
    projects=[
        ProjectEntry(
            name="Checkout Revamp",
            description="Rebuilt the checkout flow for reliability",
            achievements=[
                "Cut cart abandonment by 15%",
                "Reduced checkout latency from 2s to 400ms",
            ],
            stack=["Python", "PostgreSQL"],
        ),
        ProjectEntry(
            name="Internal Analytics Dashboard",
            description="Built a dashboard for support metrics",
            achievements=[
                "Adopted by 3 other teams",
                "Cut manual reporting time by 5 hours/week",
            ],
            stack=["React", "TypeScript"],
        ),
    ],
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
    example = _FLAT_EXAMPLE_RESULT.model_dump_json(indent=2)
    return (
        "Extract the candidate's personal information, education, work "
        "experience, skills, languages, and certifications from the resume "
        "text below. Return ONLY JSON, with EXACTLY this flat structure "
        "(this is a worked example with placeholder data, not the real "
        "candidate — match its shape exactly, especially that each skill is "
        'a flat {"name": ..., "type": ...} object, not nested). For each '
        'job, only extract its core fields (company, position, description, '
        "dates) here — do NOT invent a \"responsibilities\" or \"projects\" "
        "field for it; those are extracted separately afterward. This "
        "applies regardless of how many items are in a list — even with "
        "many skills, languages, education entries, or jobs, every single "
        'one keeps the exact same field names and shape as the example '
        '(e.g. every education entry uses "institution"/"title", never '
        '"name"):\n\n'
        f"{example}\n\n"
        "Omit fields you cannot find; use empty lists for missing sections. "
        "For an ongoing education or job with no end date, omit end_date "
        "rather than writing 'present' or 'current'.\n\n"
        f"Resume text:\n{resume_text}"
    )


def _build_work_experience_detail_prompt(
    resume_text: str,
    company: str,
    position: str,
    start_date: date,
    end_date: Optional[date],
) -> str:
    date_range = f"{start_date.isoformat()} to {end_date.isoformat() if end_date else 'present'}"
    example = _WORK_EXPERIENCE_DETAIL_EXAMPLE.model_dump_json(indent=2)
    return (
        "Below is a candidate's full resume. Focus ONLY on the work "
        f'experience entry for "{position}" at "{company}" ({date_range}) — '
        "ignore every other job. Extract that job's general duties into "
        '"responsibilities" (a list of short strings) separately from any '
        'specific initiatives into "projects" — each project is its own '
        "object with its own name, description, achievements, and stack. "
        "Return ONLY JSON with EXACTLY this structure (worked example with "
        "placeholder data, not the real candidate — match its shape "
        "exactly, regardless of how many projects/achievements/stack items "
        "this job actually has):\n\n"
        f"{example}\n\n"
        "If this job has no distinct responsibilities beyond its general "
        "description, or no named projects, return empty lists rather than "
        "inventing content.\n\n"
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


def _build_retry_prompt(
    resume_text: str,
    error: ValidationError,
    example: BaseModel,
    focus_note: str = "",
) -> str:
    example_json = example.model_dump_json(indent=2)
    error_summary = _summarize_validation_errors(error)
    return (
        "Your previous JSON output failed schema validation. Here is a "
        f"summary of what was wrong (not every occurrence, just the distinct "
        f"kinds of mistakes):\n{error_summary}\n\n"
        f"{focus_note}"
        "Here is the exact structure required again, as a worked "
        f"example with placeholder data:\n\n{example_json}\n\n"
        "Fix those mistakes and return ONLY corrected JSON matching that "
        f"shape exactly, for this resume text:\n{resume_text}"
    )


def _to_cv_extraction_result(flat: CvExtractionFlatResult) -> CvExtractionResult:
    """Convert the flat call's result (FlatWorkExperienceEntry, no
    responsibilities/projects fields) into the full CvExtractionResult shape
    (WorkExperienceEntry, responsibilities/projects defaulting to empty) that
    the rest of the pipeline — and the per-job detail merge in
    extract_structured_data — expects."""
    return CvExtractionResult(
        personal_info=flat.personal_info,
        education=flat.education,
        work_experience=[
            WorkExperienceEntry(
                company=w.company,
                position=w.position,
                description=w.description,
                start_date=w.start_date,
                end_date=w.end_date,
            )
            for w in flat.work_experience
        ],
        skills=flat.skills,
        languages=flat.languages,
        certifications=flat.certifications,
    )


def _extract_flat(resume_text: str, model: str, base_url: str) -> CvExtractionResult:
    """Extract personal_info/education/work_experience (core fields only)/
    skills/languages/certifications. Retries once with a refined prompt if the
    first attempt fails schema validation. Raises LlmSchemaValidationError if
    the retry also fails — this is still all-or-nothing, unchanged from
    before cv-extraction-multi-call.

    Validates against CvExtractionFlatResult (FlatWorkExperienceEntry has no
    responsibilities/projects fields) rather than CvExtractionResult directly
    — found via real-CV verification that the LLM still spontaneously emits a
    "projects" key for jobs the resume describes as having named projects,
    even when the prompt/example omit it; validating against a schema that
    doesn't have the field at all means Pydantic's default extra='ignore'
    silently drops it instead of failing validation."""
    raw_output = _call_ollama(_build_extraction_prompt(resume_text), model, base_url)

    try:
        return _to_cv_extraction_result(CvExtractionFlatResult.model_validate_json(raw_output))
    except ValidationError as first_error:
        logger.warning("Flat extraction failed schema validation, retrying once: %s", first_error)
        retry_prompt = _build_retry_prompt(resume_text, first_error, _FLAT_EXAMPLE_RESULT)
        retry_output = _call_ollama(retry_prompt, model, base_url)
        try:
            return _to_cv_extraction_result(CvExtractionFlatResult.model_validate_json(retry_output))
        except ValidationError as second_error:
            logger.error("Flat extraction failed schema validation after retry: %s", second_error)
            raise LlmSchemaValidationError(
                f"Flat extraction failed schema validation after one retry: {second_error}"
            ) from second_error


def _extract_work_experience_detail(
    resume_text: str,
    entry: WorkExperienceEntry,
    model: str,
    base_url: str,
) -> WorkExperienceDetailResult:
    """Extract one work experience entry's responsibilities/projects. Retries
    once independently of any other call. Raises LlmSchemaValidationError if
    the retry also fails — the caller (extract_structured_data) decides
    whether to absorb that as a partial failure or propagate it."""
    prompt = _build_work_experience_detail_prompt(
        resume_text, entry.company, entry.position, entry.start_date, entry.end_date
    )
    raw_output = _call_ollama(prompt, model, base_url)

    try:
        return WorkExperienceDetailResult.model_validate_json(raw_output)
    except ValidationError as first_error:
        logger.warning(
            "Work experience detail extraction failed for %s at %s, retrying once: %s",
            entry.position,
            entry.company,
            first_error,
        )
        date_range = f"{entry.start_date.isoformat()} to {entry.end_date.isoformat() if entry.end_date else 'present'}"
        focus_note = f'Focus ONLY on "{entry.position}" at "{entry.company}" ({date_range}).\n\n'
        retry_prompt = _build_retry_prompt(
            resume_text, first_error, _WORK_EXPERIENCE_DETAIL_EXAMPLE, focus_note
        )
        retry_output = _call_ollama(retry_prompt, model, base_url)
        try:
            return WorkExperienceDetailResult.model_validate_json(retry_output)
        except ValidationError as second_error:
            logger.error(
                "Work experience detail extraction failed for %s at %s after retry: %s",
                entry.position,
                entry.company,
                second_error,
            )
            raise LlmSchemaValidationError(
                f"Work experience detail extraction failed for {entry.position} at "
                f"{entry.company} after one retry: {second_error}"
            ) from second_error


def extract_structured_data(
    resume_text: str,
    model: str = DEFAULT_MODEL,
    base_url: str = DEFAULT_BASE_URL,
) -> CvExtractionResult:
    """Extract structured candidate data from OCR'd resume text via the local
    LLM, orchestrating two call types (see module docstring). The flat call's
    failure (after its own retry) still fails the whole extraction, exactly
    as before. A single work experience entry's detail failure (after its own
    retry) is instead absorbed: that entry persists with empty
    responsibilities/projects and the rest of the CV is unaffected."""
    result = _extract_flat(resume_text, model, base_url)

    updated_work_experience = []
    for entry in result.work_experience:
        try:
            detail = _extract_work_experience_detail(resume_text, entry, model, base_url)
            updated_entry = entry.model_copy(
                update={"responsibilities": detail.responsibilities, "projects": detail.projects}
            )
        except LlmSchemaValidationError as detail_error:
            logger.warning(
                "Absorbing work experience detail failure for %s at %s — persisting flat "
                "fields with empty responsibilities/projects: %s",
                entry.position,
                entry.company,
                detail_error,
            )
            updated_entry = entry
        updated_work_experience.append(updated_entry)

    return result.model_copy(update={"work_experience": updated_work_experience})

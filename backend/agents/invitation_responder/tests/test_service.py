import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from agents.invitation_responder import service
from agents.invitation_responder.schemas import (
    CandidateSummary,
    InvitationExtraction,
    InvitationIntent,
)

BAXTER_INVITATION = (Path(__file__).parent / "fixtures" / "baxter_invitation.txt").read_text(
    encoding="utf-8"
)

BAXTER_EXTRACTION = {
    "recruiter_name": "Alexis Aguiñaga",
    "recruiter_title": "Senior Talent Acquisition Consultant",
    "company": "Baxter International Inc.",
    "role_title": "Business Intelligence Specialist",
    "location": "Bogotá, D.C.",
    "language": "en",
    "call_to_action": "Reply to the message or schedule a call",
}

CANDIDATE = CandidateSummary(
    full_name="Rene Rangel",
    current_title="Sr. Data Steward",
    current_company="Johnson & Johnson Innovative Medicine Latinoamérica",
    previous_companies=[],
    top_skills=["SQL", "Data Governance"],
)

TAGLINE = "This is where you can do your best work while helping save and sustain lives"


def _extraction(**overrides) -> InvitationExtraction:
    return InvitationExtraction(**{**BAXTER_EXTRACTION, **overrides})


def _stub_llm(monkeypatch, outputs):
    """Replace the LLM call with a scripted sequence of outputs; returns the list of prompts seen."""
    prompts: list[str] = []
    remaining = list(outputs)

    def fake_call(prompt, model, base_url, json_mode):
        prompts.append(prompt)
        return remaining.pop(0)

    monkeypatch.setattr(service, "_call_ollama", fake_call)
    return prompts


# ---- Structured Invitation Extraction ----------------------------------


# Spec: "Reference Baxter invitation is parsed"
def test_extract_parses_the_reference_baxter_invitation(monkeypatch):
    _stub_llm(monkeypatch, [json.dumps(BAXTER_EXTRACTION)])

    result = service.extract_invitation(BAXTER_INVITATION)

    assert result.recruiter_name == "Alexis Aguiñaga"
    assert result.recruiter_title == "Senior Talent Acquisition Consultant"
    assert result.company == "Baxter International Inc."
    assert result.role_title == "Business Intelligence Specialist"
    assert result.location == "Bogotá, D.C."
    assert result.language == "en"


# Spec: "Signature tagline is ignored" — the prompt must instruct this, and a
# parse that leaks the tagline into any field is not what the schema allows us to catch,
# so the instruction itself is the guardrail under test.
def test_extraction_prompt_tells_the_model_to_ignore_signature_taglines(monkeypatch):
    prompts = _stub_llm(monkeypatch, [json.dumps(BAXTER_EXTRACTION)])

    service.extract_invitation(BAXTER_INVITATION)

    assert "tagline" in prompts[0].lower()
    assert "signature" in prompts[0].lower()
    assert TAGLINE in prompts[0]  # the invitation text itself is passed through unchanged


# Spec: "Missing information stays null"
def test_extract_keeps_missing_fields_null(monkeypatch):
    partial = {k: v for k, v in BAXTER_EXTRACTION.items() if k != "location"}
    _stub_llm(monkeypatch, [json.dumps(partial)])

    assert service.extract_invitation(BAXTER_INVITATION).location is None


def test_extraction_prompt_forbids_inventing_missing_fields(monkeypatch):
    prompts = _stub_llm(monkeypatch, [json.dumps(BAXTER_EXTRACTION)])

    service.extract_invitation(BAXTER_INVITATION)

    assert "null" in prompts[0]


# Spec: "Invalid LLM output is retried once"
def test_extract_retries_once_after_a_schema_validation_failure(monkeypatch):
    prompts = _stub_llm(monkeypatch, ['{"language": 5, "company": ["x"]}', json.dumps(BAXTER_EXTRACTION)])

    result = service.extract_invitation(BAXTER_INVITATION)

    assert result.company == "Baxter International Inc."
    assert len(prompts) == 2
    assert "failed schema validation" in prompts[1]


def test_extract_fails_when_the_retry_also_fails_validation(monkeypatch):
    prompts = _stub_llm(monkeypatch, ["not json", "still not json"])

    with pytest.raises(service.InvitationExtractionError):
        service.extract_invitation(BAXTER_INVITATION)

    assert len(prompts) == 2  # exactly one retry, never a third attempt


def test_retry_prompt_stays_small_by_not_repeating_the_full_previous_output(monkeypatch):
    long_garbage = "x" * 20000
    prompts = _stub_llm(monkeypatch, [long_garbage, json.dumps(BAXTER_EXTRACTION)])

    service.extract_invitation(BAXTER_INVITATION)

    assert long_garbage not in prompts[1]
    assert len(prompts[1]) < len(BAXTER_INVITATION) + 3000


# Spec: "Diacritics are preserved"
def test_extract_preserves_diacritics(monkeypatch):
    _stub_llm(monkeypatch, [json.dumps(BAXTER_EXTRACTION, ensure_ascii=False)])

    result = service.extract_invitation(BAXTER_INVITATION)

    assert "ñ" in result.recruiter_name
    assert "á" in result.location


def test_extraction_normalizes_the_language_code():
    assert _extraction(language=" EN ").language == "en"


def test_extraction_rejects_a_non_language_code():
    with pytest.raises(ValidationError):
        _extraction(language="this is not a language code")


# ---- Grounded Draft Reply Generation -----------------------------------

DRAFT_TEXT = (
    "Hi Alexis,\n\nThank you for reaching out about the Business Intelligence Specialist "
    "role at Baxter. I would be glad to talk more about it.\n\nBest regards,\nRene Rangel"
)


def _draft_prompt(monkeypatch, intent=InvitationIntent.INTERESTED, extraction=None, candidate=CANDIDATE):
    prompts = _stub_llm(monkeypatch, [DRAFT_TEXT])
    service.draft_reply(BAXTER_INVITATION, extraction or _extraction(), intent, candidate)
    return prompts[0]


# Spec: "Interested reply to the reference invitation"
def test_interested_draft_addresses_the_recruiter_and_names_the_role(monkeypatch):
    prompt = _draft_prompt(monkeypatch)

    assert "Alexis" in prompt
    assert "Business Intelligence Specialist" in prompt
    assert "Baxter International Inc." in prompt
    assert "interest" in prompt.lower()
    assert "call" in prompt.lower()
    assert "Johnson & Johnson Innovative Medicine Latinoamérica" in prompt
    assert "English" in prompt


def test_draft_reply_returns_the_model_text_trimmed(monkeypatch):
    _stub_llm(monkeypatch, ["\n  " + DRAFT_TEXT + "  \n"])

    result = service.draft_reply(BAXTER_INVITATION, _extraction(), InvitationIntent.INTERESTED, CANDIDATE)

    assert result == DRAFT_TEXT


# Spec: "Request-more-info reply asks for missing details"
def test_request_more_info_prompt_asks_for_missing_details_without_commitment(monkeypatch):
    prompt = _draft_prompt(monkeypatch, InvitationIntent.REQUEST_MORE_INFO).lower()

    for topic in ("job description", "compensation", "work modality", "process"):
        assert topic in prompt
    assert "commit" in prompt  # told not to commit


# Spec: "Decline reply is polite and non-committal"
def test_decline_prompt_is_polite_and_leaves_the_door_open(monkeypatch):
    prompt = _draft_prompt(monkeypatch, InvitationIntent.DECLINE).lower()

    assert "decline" in prompt
    assert "thank" in prompt
    assert "future opportunities" in prompt


# Spec: "No ungrounded facts"
def test_prompt_restricts_facts_to_the_profile_summary_and_the_invitation(monkeypatch):
    prompt = _draft_prompt(monkeypatch).lower()

    assert "only" in prompt
    assert "do not invent" in prompt


def test_prompt_does_not_mention_employers_absent_from_the_profile(monkeypatch):
    prompt = _draft_prompt(monkeypatch)

    assert "Google" not in prompt
    assert "Acme" not in prompt


def test_prompt_lists_every_known_employer_and_skill_from_the_profile(monkeypatch):
    candidate = CANDIDATE.model_copy(update={"previous_companies": ["Globant"], "top_skills": ["dbt"]})

    prompt = _draft_prompt(monkeypatch, candidate=candidate)

    assert "Globant" in prompt
    assert "dbt" in prompt


# Spec: "Reply mirrors the invitation language"
def test_spanish_invitation_produces_a_spanish_instruction(monkeypatch):
    prompt = _draft_prompt(monkeypatch, extraction=_extraction(language="es"))

    assert "Spanish" in prompt
    assert "English" not in prompt


# Spec: "Salary and availability are not invented"
def test_prompt_forbids_stating_salary_notice_period_or_availability(monkeypatch):
    prompt = _draft_prompt(monkeypatch).lower()

    for term in ("salary", "notice period", "availability"):
        assert term in prompt


def test_prompt_falls_back_to_a_neutral_greeting_without_a_recruiter_name(monkeypatch):
    prompt = _draft_prompt(monkeypatch, extraction=_extraction(recruiter_name=None))

    assert "Hello" in prompt


def test_draft_retries_once_when_the_output_is_too_short(monkeypatch):
    prompts = _stub_llm(monkeypatch, ["ok", DRAFT_TEXT])

    result = service.draft_reply(BAXTER_INVITATION, _extraction(), InvitationIntent.INTERESTED, CANDIDATE)

    assert result == DRAFT_TEXT
    assert len(prompts) == 2


def test_draft_fails_when_the_retry_is_also_too_short(monkeypatch):
    prompts = _stub_llm(monkeypatch, ["", "ok"])

    with pytest.raises(service.DraftGenerationError):
        service.draft_reply(BAXTER_INVITATION, _extraction(), InvitationIntent.INTERESTED, CANDIDATE)

    assert len(prompts) == 2

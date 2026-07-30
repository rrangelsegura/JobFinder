import json

import pytest

from agents.cv_analyst import extraction_service
from agents.cv_analyst.schemas import CvExtractionResult

VALID_JSON = json.dumps(
    {
        "personal_info": {
            "first_name": "Ada",
            "last_name": "Lovelace",
            "email": "ada@example.com",
        },
        "education": [],
        "work_experience": [],
        "skills": [],
        "languages": [],
        "certifications": [],
    }
)

INVALID_JSON = json.dumps({"personal_info": {"first_name": "Ada"}})  # missing last_name/email


# Spec: "LLM output passes schema validation"
def test_extract_structured_data_returns_result_when_first_attempt_is_valid(monkeypatch):
    calls = []

    def fake_call_ollama(prompt, model, base_url):
        calls.append(prompt)
        return VALID_JSON

    monkeypatch.setattr(extraction_service, "_call_ollama", fake_call_ollama)

    result = extraction_service.extract_structured_data("resume text", model="llama3:8b")

    assert isinstance(result, CvExtractionResult)
    assert result.personal_info.first_name == "Ada"
    assert len(calls) == 1


# Spec: "LLM output fails schema validation and is retried"
def test_extract_structured_data_retries_once_on_validation_failure(monkeypatch):
    responses = [INVALID_JSON, VALID_JSON]

    def fake_call_ollama(prompt, model, base_url):
        return responses.pop(0)

    monkeypatch.setattr(extraction_service, "_call_ollama", fake_call_ollama)

    result = extraction_service.extract_structured_data("resume text", model="llama3:8b")

    assert isinstance(result, CvExtractionResult)
    assert result.personal_info.first_name == "Ada"
    assert responses == []  # both queued responses were consumed


# Spec: "LLM output fails validation after retry"
def test_extract_structured_data_raises_after_retry_also_fails(monkeypatch):
    call_count = {"n": 0}

    def fake_call_ollama(prompt, model, base_url):
        call_count["n"] += 1
        return INVALID_JSON

    monkeypatch.setattr(extraction_service, "_call_ollama", fake_call_ollama)

    with pytest.raises(extraction_service.LlmSchemaValidationError):
        extraction_service.extract_structured_data("resume text", model="llama3:8b")

    assert call_count["n"] == 2  # exactly one retry, not an infinite loop


def test_retry_prompt_includes_the_previous_error_for_the_llm_to_fix(monkeypatch):
    captured_prompts = []

    def fake_call_ollama(prompt, model, base_url):
        captured_prompts.append(prompt)
        return INVALID_JSON if len(captured_prompts) == 1 else VALID_JSON

    monkeypatch.setattr(extraction_service, "_call_ollama", fake_call_ollama)

    extraction_service.extract_structured_data("resume text", model="llama3:8b")

    assert len(captured_prompts) == 2
    # the retry prompt should reference the validation failure, not repeat the
    # first prompt verbatim, per "refined prompt" in the hallucination-guardrail standard
    assert captured_prompts[1] != captured_prompts[0]

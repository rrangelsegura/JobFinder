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


# cv-upload-hardening: a real 5-page CV with 14 skills/2 languages made the
# LLM revert to flat strings instead of {name, type}/{name, proficiency}
# objects — the single worked example only showed 1-2 items per list.
def test_extraction_prompt_reinforces_structured_shape_regardless_of_list_length():
    prompt = extraction_service._build_extraction_prompt("resume text")

    assert "regardless of" in prompt.lower() or "no matter how many" in prompt.lower()
    assert len(extraction_service._EXAMPLE_RESULT.skills) >= 4
    assert len(extraction_service._EXAMPLE_RESULT.languages) >= 2


# cv-upload-hardening: found one layer deeper on the same real CV — with 3
# education entries, the 2nd/3rd came back using "name" instead of
# "institution"/"title", the same repetition-degradation pattern as the
# skills/languages bug above, just for a list the example only showed once.
def test_extraction_example_shows_education_repeated_at_least_twice():
    assert len(extraction_service._EXAMPLE_RESULT.education) >= 2


# cv-upload-hardening: _call_ollama never set num_ctx, so Ollama defaulted to
# 2048 tokens even though llama3:8b supports 8192 — observed for real to
# collapse the retry output entirely on a large resume.
def test_call_ollama_sets_num_ctx_explicitly(monkeypatch):
    captured_payloads = []

    class FakeResponse:
        def raise_for_status(self):
            pass

        def json(self):
            return {"response": VALID_JSON}

    def fake_post(url, json, timeout):
        captured_payloads.append(json)
        return FakeResponse()

    monkeypatch.setattr(extraction_service.httpx, "post", fake_post)

    extraction_service.extract_structured_data("resume text", model="llama3:8b")

    assert captured_payloads[0].get("options", {}).get("num_ctx") == 8192


# cv-upload-hardening: a real 5-page CV genuinely timed out at the previous
# 120s httpx timeout — num_ctx: 8192 (4x the old default) makes local CPU
# inference proportionally slower, and the old timeout was already close to
# the edge for a large document even before that increase.
def test_call_ollama_uses_a_generous_timeout_for_large_documents(monkeypatch):
    captured_timeouts = []

    class FakeResponse:
        def raise_for_status(self):
            pass

        def json(self):
            return {"response": VALID_JSON}

    def fake_post(url, json, timeout):
        captured_timeouts.append(timeout)
        return FakeResponse()

    monkeypatch.setattr(extraction_service.httpx, "post", fake_post)

    extraction_service.extract_structured_data("resume text", model="llama3:8b")

    assert captured_timeouts[0] >= 240.0


# cv-upload-hardening: the retry prompt used to concatenate the full resume
# text, the full previous (malformed) output, and the full validation error —
# for a real multi-page CV this could exceed the model's context window.
def test_retry_prompt_does_not_repeat_the_full_previous_output(monkeypatch):
    huge_marker = "UNIQUE_MARKER_" + ("x" * 3000)
    huge_invalid_output = json.dumps(
        {
            "personal_info": {"first_name": "Ada"},  # missing required fields
            "junk_field": huge_marker,
        }
    )

    captured_prompts = []

    def fake_call_ollama(prompt, model, base_url):
        captured_prompts.append(prompt)
        return huge_invalid_output if len(captured_prompts) == 1 else VALID_JSON

    monkeypatch.setattr(extraction_service, "_call_ollama", fake_call_ollama)

    extraction_service.extract_structured_data("resume text", model="llama3:8b")

    retry_prompt = captured_prompts[1]
    assert huge_marker not in retry_prompt


def test_retry_prompt_caps_a_large_validation_error_summary(monkeypatch):
    # 20 skills, each the wrong shape (flat string instead of an object) —
    # mirrors the real CV that triggered this bug.
    many_skills_invalid = json.dumps(
        {
            "personal_info": {"first_name": "Ada", "last_name": "Lovelace", "email": "ada@example.com"},
            "education": [],
            "work_experience": [],
            "skills": [f"Skill {i}" for i in range(20)],
            "languages": [],
            "certifications": [],
        }
    )

    captured_prompts = []

    def fake_call_ollama(prompt, model, base_url):
        captured_prompts.append(prompt)
        return many_skills_invalid if len(captured_prompts) == 1 else VALID_JSON

    monkeypatch.setattr(extraction_service, "_call_ollama", fake_call_ollama)

    extraction_service.extract_structured_data("resume text", model="llama3:8b")

    retry_prompt = captured_prompts[1]
    # the retry prompt should summarize/dedupe 20 near-identical errors, not
    # include a full line for every one of them
    assert retry_prompt.count("skills.") < 20

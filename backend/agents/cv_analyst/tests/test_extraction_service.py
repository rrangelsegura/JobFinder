import json
from datetime import date

import pytest

from agents.cv_analyst import extraction_service
from agents.cv_analyst.schemas import CvExtractionResult, WorkExperienceEntry

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

# cv-extraction-multi-call: a flat result with two jobs, used to exercise the
# per-job detail-call orchestration (one detail call per work_experience entry).
FLAT_JSON_WITH_TWO_JOBS = json.dumps(
    {
        "personal_info": {"first_name": "Ada", "last_name": "Lovelace", "email": "ada@example.com"},
        "education": [],
        "work_experience": [
            {"company": "Acme", "position": "Software Engineer", "start_date": "2019-07-01", "end_date": None},
            {"company": "Globex", "position": "Junior Developer", "start_date": "2017-06-01", "end_date": "2019-06-01"},
        ],
        "skills": [],
        "languages": [],
        "certifications": [],
    }
)

DETAIL_JSON_ACME = json.dumps(
    {
        "responsibilities": ["Led backend architecture"],
        "projects": [{"name": "Checkout Revamp", "achievements": ["Cut abandonment by 15%"], "stack": ["Python"]}],
    }
)
DETAIL_JSON_GLOBEX = json.dumps({"responsibilities": ["Fixed production bugs"], "projects": []})
DETAIL_INVALID_JSON = json.dumps({"projects": "not-a-list"})


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
    assert len(calls) == 1  # no work_experience entries -> no detail calls


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


# Spec: "LLM output fails validation after retry" — the flat call's own
# failure is unchanged: still all-or-nothing, no detail calls are attempted.
def test_extract_structured_data_raises_after_retry_also_fails(monkeypatch):
    call_count = {"n": 0}

    def fake_call_ollama(prompt, model, base_url):
        call_count["n"] += 1
        return INVALID_JSON

    monkeypatch.setattr(extraction_service, "_call_ollama", fake_call_ollama)

    with pytest.raises(extraction_service.LlmSchemaValidationError):
        extraction_service.extract_structured_data("resume text", model="llama3:8b")

    assert call_count["n"] == 2  # exactly the flat call + its retry, no detail calls


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
    assert len(extraction_service._FLAT_EXAMPLE_RESULT.skills) >= 4
    assert len(extraction_service._FLAT_EXAMPLE_RESULT.languages) >= 2


# cv-upload-hardening: found one layer deeper on the same real CV — with 3
# education entries, the 2nd/3rd came back using "name" instead of
# "institution"/"title", the same repetition-degradation pattern as the
# skills/languages bug above, just for a list the example only showed once.
def test_extraction_example_shows_education_repeated_at_least_twice():
    assert len(extraction_service._FLAT_EXAMPLE_RESULT.education) >= 2


# cv-extraction-multi-call: the flat call reverts to the pre-work-experience-
# detail shape — responsibilities/projects now come from a separate per-job
# detail call. The fields are structurally absent (FlatWorkExperienceEntry
# has no responsibilities/projects fields at all), not just left empty —
# real-CV verification found that even empty keys in the example nudged the
# model toward inventing content for them.
def test_flat_example_work_experience_has_no_responsibilities_or_projects():
    for entry in extraction_service._FLAT_EXAMPLE_RESULT.work_experience:
        assert not hasattr(entry, "responsibilities")
        assert not hasattr(entry, "projects")


# Same repetition-degradation lesson as skills/education above, now applied to
# the detail call's own worked example instead of the flat one.
def test_work_experience_detail_example_shows_multiple_projects_with_depth():
    example = extraction_service._WORK_EXPERIENCE_DETAIL_EXAMPLE
    assert len(example.responsibilities) >= 2
    assert len(example.projects) >= 2
    for project in example.projects:
        assert len(project.achievements) >= 2
        assert len(project.stack) >= 2


def test_work_experience_detail_prompt_includes_job_identifying_info():
    prompt = extraction_service._build_work_experience_detail_prompt(
        "resume text",
        company="Acme Corp",
        position="Software Engineer",
        start_date=date(2019, 7, 1),
        end_date=None,
    )
    assert "Acme Corp" in prompt
    assert "Software Engineer" in prompt


def test_extract_work_experience_detail_returns_result_when_valid(monkeypatch):
    entry = WorkExperienceEntry(company="Acme", position="Engineer", start_date="2020-01-01")
    calls = []

    def fake_call_ollama(prompt, model, base_url):
        calls.append(prompt)
        return DETAIL_JSON_ACME

    monkeypatch.setattr(extraction_service, "_call_ollama", fake_call_ollama)

    result = extraction_service._extract_work_experience_detail("resume text", entry, "llama3:8b", "http://x")

    assert result.responsibilities == ["Led backend architecture"]
    assert len(result.projects) == 1
    assert len(calls) == 1


def test_extract_work_experience_detail_retries_once_then_raises(monkeypatch):
    entry = WorkExperienceEntry(company="Acme", position="Engineer", start_date="2020-01-01")
    call_count = {"n": 0}

    def fake_call_ollama(prompt, model, base_url):
        call_count["n"] += 1
        return DETAIL_INVALID_JSON

    monkeypatch.setattr(extraction_service, "_call_ollama", fake_call_ollama)

    with pytest.raises(extraction_service.LlmSchemaValidationError):
        extraction_service._extract_work_experience_detail("resume text", entry, "llama3:8b", "http://x")

    assert call_count["n"] == 2


# cv-extraction-multi-call: found via real-CV verification (not guessed) —
# even with responsibilities/projects removed from the flat call's prompt
# and example, the LLM still spontaneously emitted a "projects" key (as a
# flat list of strings, not objects) for jobs the resume describes as having
# named projects, failing validation on the very first real re-verification
# attempt. This reproduces that exact shape and confirms it's now tolerated.
def test_flat_extraction_silently_ignores_a_hallucinated_projects_field(monkeypatch):
    flat_json_with_hallucinated_projects = json.dumps(
        {
            "personal_info": {"first_name": "Ada", "last_name": "Lovelace", "email": "ada@example.com"},
            "education": [],
            "work_experience": [
                {
                    "company": "Acme",
                    "position": "Software Engineer",
                    "start_date": "2019-07-01",
                    "end_date": None,
                    "projects": ["Checkout Revamp", "Fraud Detection Service"],
                }
            ],
            "skills": [],
            "languages": [],
            "certifications": [],
        }
    )
    calls = []

    def fake_call_ollama(prompt, model, base_url):
        calls.append(prompt)
        return flat_json_with_hallucinated_projects if len(calls) == 1 else DETAIL_JSON_ACME

    monkeypatch.setattr(extraction_service, "_call_ollama", fake_call_ollama)

    result = extraction_service.extract_structured_data("resume text", model="llama3:8b")

    assert len(calls) == 2  # flat call succeeded on the first attempt (no retry) + 1 detail call
    assert result.work_experience[0].company == "Acme"


def test_extract_structured_data_calls_flat_then_one_detail_call_per_job_and_merges(monkeypatch):
    responses = [FLAT_JSON_WITH_TWO_JOBS, DETAIL_JSON_ACME, DETAIL_JSON_GLOBEX]
    captured_prompts = []

    def fake_call_ollama(prompt, model, base_url):
        captured_prompts.append(prompt)
        return responses.pop(0)

    monkeypatch.setattr(extraction_service, "_call_ollama", fake_call_ollama)

    result = extraction_service.extract_structured_data("resume text", model="llama3:8b")

    assert len(captured_prompts) == 3  # 1 flat call + 2 detail calls (one per job)
    assert result.work_experience[0].company == "Acme"
    assert result.work_experience[0].responsibilities == ["Led backend architecture"]
    assert len(result.work_experience[0].projects) == 1
    assert result.work_experience[0].projects[0].name == "Checkout Revamp"
    assert result.work_experience[1].company == "Globex"
    assert result.work_experience[1].responsibilities == ["Fixed production bugs"]
    assert result.work_experience[1].projects == []


# cv-extraction-multi-call: the whole point of splitting per job — one job's
# unrecoverable detail failure must not sink the rest of the CV's extraction.
def test_one_jobs_detail_failure_is_absorbed_not_raised(monkeypatch, caplog):
    responses = [FLAT_JSON_WITH_TWO_JOBS, DETAIL_INVALID_JSON, DETAIL_INVALID_JSON, DETAIL_JSON_GLOBEX]

    def fake_call_ollama(prompt, model, base_url):
        return responses.pop(0)

    monkeypatch.setattr(extraction_service, "_call_ollama", fake_call_ollama)

    caplog.set_level("WARNING")
    result = extraction_service.extract_structured_data("resume text", model="llama3:8b")

    assert result.work_experience[0].company == "Acme"
    assert result.work_experience[0].responsibilities == []
    assert result.work_experience[0].projects == []
    assert result.work_experience[1].company == "Globex"
    assert result.work_experience[1].responsibilities == ["Fixed production bugs"]
    assert "Acme" in caplog.text


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

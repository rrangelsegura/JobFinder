## Context

Reproduced live via `docker compose logs backend-agent` against a real CV upload (resume id 5, candidate's own test account):

```
Flat extraction failed schema validation, retrying once: 6 validation errors for CvExtractionFlatResult
skills.9.type
  Input should be 'technical' or 'soft' [type=enum, input_value='tool', input_type=str]
... (5 more of the same kind)
Flat extraction failed schema validation after retry: 1 validation error for CvExtractionFlatResult
  Invalid JSON: EOF while parsing an object at line 74 column 23 [type=json_invalid, input_value='{"personal_info": {\n  "...t\t\t\t\t\t\t\t\t\t\t\t', input_type=str]
```

The first attempt failed because the model classified several skills as `"tool"`. The retry — triggered specifically to fix that — itself produced truncated, unparseable JSON (note the trailing run of tab characters, a known local-model degeneration pattern under context pressure). Since `_extract_flat` only retries once, this CV's extraction failed outright.

## Goals / Non-Goals

**Goals:**
- Stop the model from inventing a `"tool"` skill type in the first place, for this class of CV.
- Reduce the retry prompt's size so a retry has more room to actually complete its JSON, for any CV that needs one — not just this specific failure mode.

**Non-Goals:**
- Adding `"tool"` as a legitimate third `SkillType` value. The existing requirement ("a skill's `type` SHALL classify it as `technical` or `soft` only") is correct — tools, frameworks, and platforms are technical skills. This is a prompt-robustness fix, not a schema change.
- A second retry attempt. Two failed attempts on this real CV (one for the type error, one truncated) is exactly the ordinary one-retry budget working as designed; the fix is making each attempt more likely to succeed, not adding a third attempt.
- Increasing `_NUM_CTX` beyond 8192 — already documented as llama3:8b's hard ceiling, not a tunable value.

## Decisions

**1. State the `"technical"` vs. tools/frameworks/platforms rule explicitly in the flat-extraction prompt, not just the retry's error summary.**
The existing prompt already explains `type` is only `"technical"`/`"soft"` and distinguishes it from `proficiency`, but never addresses the specific ambiguity a model might reasonably feel about a tool or platform. Naming that ambiguity and resolving it directly (e.g. "Docker, Git, AWS, and every other tool/framework/platform/technology is `technical`") closes the gap at its source — the first attempt — rather than relying on the retry's per-item error message (`Input should be 'technical' or 'soft'`) to correct it after the fact, which is what led to the retry itself hitting a different failure mode (truncation) before that correction could land.

**2. The shared retry-prompt builder drops the full worked-example JSON; a short field-name reminder replaces it.**
The model already produced JSON that was structurally close to correct (specific field values/types were wrong, not the overall shape) — that's what a validation-error retry means, as opposed to a shape failure. Re-teaching the full shape via a complete worked example a second time is the single largest addition the retry prompt makes over the original, and — per the module's own established lesson from `cv-upload-hardening` (already dropping the full previous output, already capping the error summary) — is the next place still unconditionally growing the retry prompt regardless of the source CV's size. A field-name list (e.g. `personal_info, education, work_experience, skills, languages, certifications`) plus the existing deduped error summary (which already quotes the correct value inline, e.g. `Input should be 'technical' or 'soft'`) is enough context to fix specific field mistakes without re-spending the budget on the whole shape again.

**3. No change to the number of retries or to `_NUM_CTX`.**
Per Non-Goals — this is about making each of the two existing attempts (initial + one retry) more likely to succeed, not changing the retry budget itself.

## Migration Plan

1. `_build_extraction_prompt`: extend the existing skill-type/proficiency sentence to explicitly name tools/frameworks/platforms/technologies as `"technical"`.
2. `_build_retry_prompt`: replace `example.model_dump_json(indent=2)` with a short reminder built from `type(example).model_fields.keys()` instead of the full serialized example.
3. Rollback: revert both prompt-builder changes — no schema, persistence, or test-fixture changes accompany them beyond the two functions' own unit tests.

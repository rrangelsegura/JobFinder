## Why

Reproduced against a real, detailed CV during manual testing (not a fixture): extraction failed with the generic system-side error message. Backend logs revealed two distinct, real bugs, both confirmed from actual Ollama output, not guessed:

1. **`skills[].type` invented a third value.** The schema only allows `"technical"`/`"soft"`, but llama3:8b classified several skills (tools/platforms like Docker, Git, AWS) as `"tool"` instead — 6+ occurrences in this one CV. This reliably triggers the one-shot retry every time this CV (or one like it) is processed.
2. **The retry itself then failed from context-budget truncation.** The retry prompt repeats the full worked-example JSON on top of the error summary and the full resume text. For this detailed CV, that pushed the retry prompt close enough to llama3:8b's fixed 8192-token context ceiling that the model's JSON output was cut off mid-object — an unrecoverable failure, since there is only one retry.

Backend logs show this same CV had already needed (and previously survived) a retry on two earlier upload attempts for unrelated reasons (a truncated list, a missing `certifications[].name`) — this is a recurring reliability gap for real-world CVs, not a one-off.

## What Changes

- The flat-extraction prompt explicitly states that tools, frameworks, platforms, and technologies of any kind are `"technical"` — never a separate `"tool"` category — closing the specific gap that caused this CV's retry.
- The shared retry-prompt builder no longer re-serializes the full worked-example JSON. It keeps the deduped, capped error summary (already implemented) and a short field-name reminder instead, freeing real context budget for the resume text and the model's completion — reducing truncation risk for any CV that needs a retry, not just this one.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `cv-extraction`: the retry prompt is further budget-hardened (no repeated worked example); the flat-extraction prompt closes the `skills[].type` ambiguity.

## Impact

- **Backend only**: `backend/agents/cv_analyst/extraction_service.py` — `_build_extraction_prompt` (skill-type clarification) and `_build_retry_prompt` (drop the full example). No schema, persistence, or API changes.

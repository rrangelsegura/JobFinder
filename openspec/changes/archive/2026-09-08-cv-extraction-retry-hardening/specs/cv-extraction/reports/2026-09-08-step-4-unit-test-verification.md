# Verification Report — cv-extraction-retry-hardening

Date: 2026-09-08

## Step 4: Unit Tests and Builds

### Backend (Python/pytest)

New/updated tests in `test_extraction_service.py` (25 tests in this file, up from 22):
- `test_extraction_prompt_classifies_tools_and_platforms_as_technical`
- `test_retry_prompt_does_not_repeat_the_full_worked_example`
- `test_work_experience_detail_retry_prompt_does_not_repeat_the_full_worked_example`

All three existing retry-related tests (`test_retry_prompt_includes_the_previous_error_for_the_llm_to_fix`,
`test_retry_prompt_does_not_repeat_the_full_previous_output`,
`test_retry_prompt_caps_a_large_validation_error_summary`) pass unmodified.

```
cd backend && .venv/Scripts/python.exe -m pytest
```
Result: **81 passed** (78 baseline + 3 new).

### Backend (Node/Jest) and Frontend (Vitest) — regression checks only

No files in either touched by this change.

```
cd backend && npm test
```
Result: **12 test suites, 87 tests — all passed.**

```
cd frontend && npx vitest run
```
Result: **17 test files, 67 tests — all passed.**

### Builds / Lint

- No backend-Python lint/format step exists in this project's CI (`backend-python` job runs `pytest` only) — nothing to check beyond the test run above.
- Backend Node build/frontend build untouched by this change (no files in either).

## Step 5: Manual Verification Against the Real Failing CV

Rebuilt and recreated `backend-agent` (`docker compose build backend-agent && docker compose up -d backend-agent`) so the running container picked up the fix — it has no hot-reload.

Re-enqueued the exact resume that failed in production use (resume id 5,
the project owner's own real CV, candidate id 1) directly via
`cvExtractionQueue.add` (no route exists to re-trigger an existing
resume's extraction, and re-uploading would need the owner's own
credentials) — new job id 6.

**Before this fix** (original job 5, same CV):
```
Flat extraction failed schema validation, retrying once: 6 validation errors
skills.9.type: Input should be 'technical' or 'soft' [input_value='tool']
...
Flat extraction failed schema validation after retry: Invalid JSON: EOF while
parsing an object at line 74 column 23 [truncated output]
LLM extraction failed for resume 5 → job marked failed, generic error shown to candidate
```

**After this fix** (job 6, same CV, ~4m11s wall-clock — `durationMs: 250991`):
- The flat call succeeded on its **first** attempt — no `skills[].type`
  validation error at all this time.
- All 9 extracted skills have `"type": "technical"` — none `"tool"` or any
  other invalid value.
- One work-experience detail call (for "Technical Data Leader" at
  "Direktio S.A.S.") failed validation and needed its one retry — unrelated
  to either fix in this change — and **succeeded** on that retry, confirming
  the leaner retry prompt still carries enough information to fix a real
  validation error.
- Job 6 completed successfully end-to-end: personal info, 2 education
  entries, 11 work experience entries (with responsibilities/projects),
  9 skills, 2 languages, 2 certifications all persisted.

## Outcome

Steps 4 and 5 both **PASS**. The exact real-world CV that previously failed
now extracts successfully, and the underlying mechanism (fewer tokens spent
repeating the worked example on retry) is confirmed working on an
unrelated retry that occurred during the same run. No blocking issues.
This change is ready to commit, push, and open as a PR.

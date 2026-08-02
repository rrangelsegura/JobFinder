## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [x] 0.1 Create feature branch `feature/cv-extraction-multi-call` — from `feature/work-experience-detail` after committing it (not from `main`, which doesn't yet have work-experience-detail's code at all; this change directly modifies files work-experience-detail just created)
- [x] 0.2 Verify branch creation and current branch status
- [x] 0.3 Archive `work-experience-detail` (sync its delta specs to `openspec/specs/`) if not already done — done, archived to `openspec/changes/archive/2026-08-01-work-experience-detail/`

## 1. Backend Agent: Detail Result Schema (TDD)

- [x] 1.1 Write a pytest asserting a new `WorkExperienceDetailResult` model accepts `responsibilities: list[str]` and `projects: list[ProjectEntry]`, both defaulting to empty lists
- [x] 1.2 Implement `WorkExperienceDetailResult` in `backend/agents/cv_analyst/schemas.py`, reusing `ProjectEntry` unchanged

## 2. Backend Agent: Flat Extraction Call Reverts to Pre-Detail Shape (TDD)

- [x] 2.1 Write a pytest asserting the flat extraction prompt's worked example `work_experience` entries do NOT include `responsibilities`/`projects` keys (confirms the flat call's target shrinks back)
- [x] 2.2 Update `_EXAMPLE_RESULT` (renamed `_FLAT_EXAMPLE_RESULT`) and the flat prompt builder accordingly — kept everything else `work-experience-detail`/`cv-upload-hardening` already added (length-invariant instruction, context budget) unchanged
- [x] 2.3 Confirm existing flat-extraction tests (schema coverage, date normalization, retry/error-summary behavior) still pass — 50/50

## 3. Backend Agent: Per-Job Detail Extraction Call (TDD)

- [x] 3.1 Write a pytest asserting a new `_build_work_experience_detail_prompt(resume_text, company, position, start_date, end_date)` includes the job's identifying info so the model knows which job to focus on
- [x] 3.2 Write a pytest asserting the detail prompt's worked example shows 2+ projects, each with 2+ achievements and 2+ stack items (same depth-under-repetition requirement as the flat call learned in `cv-upload-hardening`/`work-experience-detail`, scoped to one job)
- [x] 3.3 Implement the detail prompt builder and its worked example
- [x] 3.4 Write a pytest asserting a new `_extract_work_experience_detail(resume_text, work_experience_entry)` function calls Ollama, validates against `WorkExperienceDetailResult`, and retries once independently on validation failure — reusing `_summarize_validation_errors`/`_MAX_RETRY_ERRORS_SHOWN` unchanged
- [x] 3.5 Write a pytest asserting `_extract_work_experience_detail` raises after its own retry also fails (the orchestrator, not this function, decides how to handle that)
- [x] 3.6 Implement `_extract_work_experience_detail`

## 4. Backend Agent: Orchestration and Partial-Failure Absorption (TDD)

- [x] 4.1 Write a pytest asserting `extract_structured_data` calls the flat extraction first, then one detail call per resulting work experience entry, merging `responsibilities`/`projects` back into each entry in the final `CvExtractionResult`
- [x] 4.2 Write a pytest asserting `extract_structured_data` still raises `LlmSchemaValidationError` (unchanged propagation) if the flat call itself fails schema validation after its retry — no detail calls are attempted in that case
- [x] 4.3 Write a pytest asserting that if ONE work experience entry's detail call fails after its own retry, `extract_structured_data` does NOT raise — it returns the full result with that entry's `responsibilities`/`projects` empty, and the other entries' details populated normally
- [x] 4.4 Write a pytest asserting the absorbed per-job failure is logged (e.g. via `caplog`, asserting a `logger.warning` call)
- [x] 4.5 Implement the orchestration and partial-failure absorption in `extract_structured_data`
- [x] 4.6 Write a pytest asserting a CV with zero work experience entries makes zero detail calls (no regression for the empty case) — already covered by the first existing test (`len(calls) == 1`), no duplicate needed

## 5. Review and Update Existing Unit Tests (MANDATORY)

- [x] 5.1 Run the full Python pytest suite; identify anything else broken by the flat-call shape reverting or the new orchestration — 56/56 passed, nothing else broken
- [x] 5.2 Rewrite (not just extend) the "worked example depth" tests from `work-experience-detail` that assumed one combined call — done, now target `_FLAT_EXAMPLE_RESULT` (asserts no responsibilities/projects) and `_WORK_EXPERIENCE_DETAIL_EXAMPLE` (asserts 2+ projects/achievements/stack) separately
- [x] 5.3 Confirm `router.py` and `backend/api/queue/cvExtractionProcessor.ts` needed zero changes — confirmed: neither file was touched, and their full test suites (53/53 Jest) pass unchanged

## 6. Run Unit Tests and Verify State (MANDATORY)

- [x] 6.1 Run the full backend Jest suite and the full Python pytest suite
- [x] 6.2 Run `npm run build` (frontend) and `npm run lint`
- [x] 6.3 Create report `specs/reports/YYYY-MM-DD-step-6-unit-test-and-build-verification.md`

## 7. Manual / Real Verification (MANDATORY - AGENT MUST EXECUTE)

- [x] 7.1 Rebuild and restart `backend-agent` with the changes
- [x] 7.2 Re-process the SAME real 6-job CV that failed in `work-experience-detail`'s manual verification (candidates 10/17, or a fresh upload of the same file) — this is the entire point of this change; do not declare success against a synthetic CV alone — first attempt found a NEW real bug (hallucinated `projects` field survived prompt-level suppression), fixed with a schema-level fix (`FlatWorkExperienceEntry`), second attempt succeeded for real
- [x] 7.3 Confirm in Postgres that all (or nearly all) 6 work experiences now have `responsibilities`/`projects`/`achievements`/`stack` populated — document exactly how many succeeded vs. were absorbed as partial failures, for real, not assumed — both candidates fully populated (see report table)
- [x] 7.4 If any job's detail is still absorbed as a partial failure, confirm it's logged and that the rest of the CV (flat fields for that job, all other jobs' details, all other sections) persisted correctly regardless — one real per-job retry occurred and succeeded; absorption path itself already covered by unit test
- [x] 7.5 Time the real extraction end-to-end and record it in the report — confirm or correct the design.md prediction that this is not faster (and may be slower) than the single-call approach — corrected: ~4.5 min/resume, faster and more reliable than several single-call attempts
- [x] 7.6 Clean up any test data created; document results in report `specs/reports/YYYY-MM-DD-step-7-manual-verification.md` — no new test data created, nothing to clean up

## 8. Documentation

- [x] 8.1 Confirm `docs/backend-standards.md`'s hallucination-guardrail description ("validation layer... trigger a retry with a refined prompt") still matches — confirmed as-is, no changes needed; the principle applies identically, just now twice (once per call type) instead of once globally

## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [x] 0.1 Create feature branch `feature/cv-extraction-retry-hardening` from `main`
- [x] 0.2 Verify branch creation and current branch status

## 1. Diagnosis (already done)

- [x] 1.1 Reproduce the reported failure via `docker compose logs backend-agent` against the real failed job
- [x] 1.2 Identify both root causes: `skills[].type` = `"tool"` hallucination, and retry-prompt truncation from context-budget pressure

## 2. Backend: Prompt Fixes

- [x] 2.1 `_build_extraction_prompt`: extend the skill-type sentence to explicitly classify tools/frameworks/platforms/technologies as `technical`
- [x] 2.2 `_build_retry_prompt`: replace the full serialized worked example with a short field-name reminder derived from the example's own model fields

## 3. Backend: Tests (TDD)

- [x] 3.1 `_build_extraction_prompt` mentions tools/frameworks/platforms as `technical` (extends the existing skill-type test)
- [x] 3.2 `_build_retry_prompt`'s output does not contain the full worked example's placeholder content (e.g. `"Jane"`, `"Acme Corp"`) for the flat-extraction retry
- [x] 3.3 Same, for the work-experience-detail retry (shared builder)
- [x] 3.4 Existing retry tests (`test_retry_prompt_includes_the_previous_error_for_the_llm_to_fix`, `test_retry_prompt_does_not_repeat_the_full_previous_output`, `test_retry_prompt_caps_a_large_validation_error_summary`) still pass unmodified

## 4. Run Unit Tests and Verify (MANDATORY)

- [x] 4.1 Run the full local suite (Jest backend/, pytest backend/, Vitest frontend/) — confirm green (this change is Python-only; Jest/Vitest are regression checks)
- [x] 4.2 Both builds clean, lint/format clean
- [x] 4.3 Create verification report at `openspec/changes/cv-extraction-retry-hardening/specs/cv-extraction/reports/YYYY-MM-DD-step-4-unit-test-verification.md`

## 5. Manual Verification Against the Real Failing CV (MANDATORY)

- [x] 5.1 Re-upload the exact CV that failed (resume id 5) against the fixed code and confirm it now extracts successfully
- [x] 5.2 Confirm no skill is classified with a non-`technical`/`soft` type in the result
- [x] 5.3 Document the before/after in the same report as step 4

## 6. Close Out

- [ ] 6.1 Push branch, open PR (required — `main` is protected)
- [ ] 6.2 Confirm all three CI checks pass and the PR is mergeable
- [ ] 6.3 Merge once steps 4-5 pass and the project owner confirms explicitly
- [ ] 6.4 Propose `openspec archive cv-extraction-retry-hardening` per the project's standard change lifecycle

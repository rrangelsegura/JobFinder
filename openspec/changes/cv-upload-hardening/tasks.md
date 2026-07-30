## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [ ] 0.1 Create feature branch `feature/cv-upload-hardening` from main
- [ ] 0.2 Verify branch creation and current branch status

## 1. Backend Agent: LLM Prompt Robustness for Long Lists (TDD)

- [ ] 1.1 Write a pytest asserting the extraction prompt includes an explicit "structured object regardless of list length" instruction (`test_extraction_service.py`)
- [ ] 1.2 Extend `_EXAMPLE_RESULT` to 4-5 skills / 2 languages and add the length-invariant instruction to `_build_extraction_prompt`
- [ ] 1.3 Confirm existing prompt-shape tests still pass

## 2. Backend Agent: Retry Prompt Context Budget (TDD)

- [ ] 2.1 Write a pytest asserting `_call_ollama` is invoked with `options: {"num_ctx": 8192}` on both the initial and retry calls
- [ ] 2.2 Implement: pass `num_ctx` explicitly in `_call_ollama`'s request body
- [ ] 2.3 Write a pytest asserting the retry prompt does NOT include the full previous (malformed) output, only a summary of what was wrong
- [ ] 2.4 Update `_build_retry_prompt` accordingly; update/replace the now-invalid `test_retry_prompt_includes_the_previous_error_for_the_llm_to_fix` test
- [ ] 2.5 Write a pytest asserting a validation error with many field errors (e.g. 20 skill-shape errors) produces a capped/deduplicated error summary in the retry prompt, not one line per item
- [ ] 2.6 Implement the error-summary capping

## 3. Backend: One-Shot Failure Acknowledgment Email (TDD)

- [ ] 3.1 Write unit tests for a new `sendExtractionFailureEmail(to: string)` in `backend/api/lib/emailService.ts` (mirrors `sendCvUploadReminderEmail`'s pattern)
- [ ] 3.2 Implement `sendExtractionFailureEmail`
- [ ] 3.3 Write a unit test for the BullMQ `worker.on('failed', ...)` handler in `backend/api/index.ts`: looks up the candidate's email via `job.data.candidateId` and calls `sendExtractionFailureEmail` exactly once
- [ ] 3.4 Implement the handler update

## 4. Frontend: Adopt Shadcn Input/Label/Card (TDD where behavior is asserted)

- [ ] 4.1 `npx shadcn add input label card` (radix-nova preset, matching `components.json`)
- [ ] 4.2 Update `LoginPage.tsx` to use `Input`/`Label`/`Card` instead of raw elements; confirm existing `LoginPage.test.tsx` still passes unchanged (behavior, not markup, is under test)
- [ ] 4.3 Update `RegisterPage.tsx` the same way; confirm `RegisterPage.test.tsx` still passes
- [ ] 4.4 Update `CvUploadForm.tsx` the same way; confirm `CvUploadForm.test.tsx` still passes
- [ ] 4.5 Wrap `WorkspaceLayout`'s nav and `UploadPage`'s content in `Card`/`CardContent` for consistent visual structure; confirm `WorkspaceLayout.test.tsx` still passes

## 5. Frontend: Honest System-Failure Messaging (TDD)

- [ ] 5.1 Write tests for `errorMessages.ts`: the `"OCR failed"`, `"schema validation"`, and unrecognized-error entries no longer say "try again"; the file-level entries (`"Unsupported file type"`, `"exceeds the maximum allowed size"`, `"unreadable or corrupted"`) are unchanged
- [ ] 5.2 Update the copy in `errorMessages.ts` accordingly

## 6. Review and Update Existing Unit Tests (MANDATORY)

- [ ] 6.1 Run the full backend Jest suite and the full Python pytest suite; identify anything else broken by these changes
- [ ] 6.2 Run the full frontend Vitest suite; identify anything broken by the Shadcn adoption or copy changes
- [ ] 6.3 Fix any broken tests found

## 7. Run Unit Tests and Verify State (MANDATORY)

- [ ] 7.1 Run the full backend Jest suite, the full Python pytest suite, and the full frontend Vitest suite
- [ ] 7.2 Run `npm run build` (frontend); confirm zero TypeScript errors
- [ ] 7.3 Create report `specs/reports/YYYY-MM-DD-step-7-unit-test-and-build-verification.md`

## 8. Manual / Real Verification (MANDATORY - AGENT MUST EXECUTE)

- [ ] 8.1 Rebuild and restart `backend-agent` and `backend-api` with the fixes
- [ ] 8.2 Re-upload the SAME real 5-page CV that originally failed (register a fresh test candidate); observe whether it now succeeds
- [ ] 8.3 If it still fails, capture the new failure mode for real (don't guess) and document it — this task is about learning the truth, not forcing a pass
- [ ] 8.4 Verify in Postgres that a successful extraction lands correctly on `Resume` (per `candidate-authentication`'s identity separation)
- [ ] 8.5 Trigger a real extraction failure (if one occurs naturally in 8.2/8.3, otherwise construct one) and verify via `docker logs infra-maildev-1` / the maildev web UI that exactly one acknowledgment email was sent, with the corrected copy
- [ ] 8.6 Visually confirm (via `curl`/dev server response or a description of the rendered DOM) that login, register, and upload forms now render Shadcn's bordered `Input` components, not raw unstyled fields
- [ ] 8.7 Clean up any test data created; document results in report `specs/reports/YYYY-MM-DD-step-8-manual-verification.md`

## 9. Documentation

- [ ] 9.1 Confirm `docs/backend-standards.md`'s hallucination-guardrail description still matches (retry-once-with-refined-prompt behavior, now context-budgeted) or note deviations
- [ ] 9.2 Confirm `docs/frontend-standards.md`'s UI/UX standards still match, or note deviations

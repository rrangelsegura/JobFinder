## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [ ] 0.1 Create feature branch `feature/cv-extraction-progress-phases` from `main`
- [ ] 0.2 Verify branch creation and current branch status

## 1. Backend: Worker Progress Reporting

- [ ] 1.1 `cvExtractionProcessor.ts`: call `job.updateProgress({ phase: "extracting" })` before `callAgent()`
- [ ] 1.2 `cvExtractionProcessor.ts`: call `job.updateProgress({ phase: "saving" })` before `prisma.$transaction(...)`

## 2. Backend: Status Endpoint

- [ ] 2.1 `uploadStatus.ts`: when BullMQ state is `waiting` or `delayed`, respond with `phase: "queued"`
- [ ] 2.2 `uploadStatus.ts`: when state is `active`, read `job.progress` and use its `phase`, defaulting to `"extracting"` if progress hasn't been set yet
- [ ] 2.3 `completed`/`failed` responses unchanged (no `phase` field on those)

## 3. Backend: Tests (TDD)

- [ ] 3.1 `uploadStatus.test.ts` (or wherever these tests live): `waiting`/`delayed` state → `phase: "queued"`
- [ ] 3.2 `active` state with `job.progress = { phase: "saving" }` → `phase: "saving"`
- [ ] 3.3 `active` state with no progress set yet → defaults to `phase: "extracting"`
- [ ] 3.4 `completed`/`failed` responses have no `phase` field (unchanged shape)
- [ ] 3.5 `cvExtractionProcessor.test.ts`: `job.updateProgress` called with `{ phase: "extracting" }` before the agent call, and `{ phase: "saving" }` before the transaction

## 4. Frontend: Data Layer and UI

- [ ] 4.1 `useCvExtractionStatus.ts`: add `phase?: "queued" | "extracting" | "saving"` to the status type
- [ ] 4.2 `UploadStatusIndicator.tsx`: phase-specific copy for queued/extracting/saving, falling back to the existing generic message when `phase` is absent

## 5. Frontend: Review and Update Existing Unit Tests (MANDATORY)

- [ ] 5.1 `UploadStatusIndicator.test.tsx` (or `UploadPage.test.tsx`, wherever coverage lives): add cases for each phase's copy, plus the no-phase fallback
- [ ] 5.2 Confirm no existing test asserts a fixed "processing" message that the phase-specific copy would now contradict

## 6. Run Unit Tests and Verify (MANDATORY)

- [ ] 6.1 Run the full local suite (Jest backend/, pytest backend/, Vitest frontend/) — confirm green
- [ ] 6.2 Both builds (backend, frontend) clean
- [ ] 6.3 Create verification report at `openspec/changes/cv-extraction-progress-phases/specs/cv-extraction-status/reports/YYYY-MM-DD-step-6-unit-test-verification.md`

## 7. Manual Endpoint Testing with curl (MANDATORY)

- [ ] 7.1 Upload a real CV (large enough that the agent call takes noticeable time) and poll `GET /uploads/cv/:jobId` repeatedly
- [ ] 7.2 Confirm the response shows `phase: "extracting"` for most of the duration, then `phase: "saving"` briefly before `status: "completed"`
- [ ] 7.3 Document the observed phase transitions (with timestamps) in the same report as step 6

## 8. E2E Testing with Playwright MCP (MANDATORY — this change has a real UI)

- [ ] 8.1 Upload a CV in the browser and confirm the UI text changes as the phase changes (not just a static spinner)
- [ ] 8.2 Document with a screenshot or transcript in the same report as step 6

## 9. Close Out

- [ ] 9.1 Push branch, open PR (required — `main` is protected)
- [ ] 9.2 Confirm all three CI checks pass and the PR is mergeable
- [ ] 9.3 Merge once steps 6-8 pass and the project owner confirms explicitly
- [ ] 9.4 Propose `openspec archive cv-extraction-progress-phases` per the project's standard change lifecycle

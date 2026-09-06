## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [x] 0.1 Create feature branch `feature/cv-extraction-duration` from `main`
- [x] 0.2 Verify branch creation and current branch status

## 1. Backend: Status Endpoint

- [x] 1.1 `uploadStatus.ts`: add `durationMs: job.finishedOn - job.timestamp` to the `completed` response
- [x] 1.2 `uploadStatus.ts`: add the same to the `failed` response
- [x] 1.3 `processing` responses unchanged (no `durationMs` field — the job hasn't finished)

## 2. Backend: Tests (TDD)

- [x] 2.1 `completed` response includes `durationMs` computed from `finishedOn - timestamp`
- [x] 2.2 `failed` response includes `durationMs`
- [x] 2.3 `processing` response has no `durationMs` field

## 3. Frontend: Data Layer and UI

- [x] 3.1 `useCvExtractionStatus.ts`: add `durationMs?: number` to the type
- [x] 3.2 `UploadStatusIndicator.tsx`: a small formatter (`< 60s` → "N seconds", `>= 60s` → "Nm Ss") and display it in the success message
- [x] 3.3 Failure message unchanged (duration deliberately not shown there, per design.md)

## 4. Frontend: Review and Update Existing Unit Tests (MANDATORY)

- [x] 4.1 Update the existing "shows a success state on completion" test if its assertion would otherwise conflict with the new duration text
- [x] 4.2 Add cases: duration under a minute, duration over a minute, success with no `durationMs` (fallback — message still renders without a duration clause)

## 5. Run Unit Tests and Verify (MANDATORY)

- [x] 5.1 Run the full local suite (Jest backend/, pytest backend/, Vitest frontend/) — confirm green
- [x] 5.2 Both builds clean, lint/format clean
- [x] 5.3 Create verification report at `openspec/changes/cv-extraction-duration/specs/cv-extraction-status/reports/YYYY-MM-DD-step-5-unit-test-verification.md`

## 6. Manual Endpoint Testing with curl (MANDATORY)

- [x] 6.1 Upload a real CV, wait for completion, confirm `durationMs` in the response is a plausible positive number matching the observed wall-clock wait
- [x] 6.2 Document in the same report as step 5

## 7. E2E Testing with Playwright MCP (MANDATORY — this change has a real UI)

- [x] 7.1 Upload a CV in the browser and confirm the success message shows a duration
- [x] 7.2 Document with a screenshot or transcript in the same report as step 5

## 8. Close Out

- [x] 8.1 Push branch, open PR (required — `main` is protected)
- [x] 8.2 Confirm all three CI checks pass and the PR is mergeable
- [x] 8.3 Merge once steps 5-7 pass and the project owner confirms explicitly
- [x] 8.4 Propose `openspec archive cv-extraction-duration` per the project's standard change lifecycle

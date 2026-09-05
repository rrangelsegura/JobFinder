## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [ ] 0.1 Create feature branch `feature/cv-extraction-duration` from `main`
- [ ] 0.2 Verify branch creation and current branch status

## 1. Backend: Status Endpoint

- [ ] 1.1 `uploadStatus.ts`: add `durationMs: job.finishedOn - job.timestamp` to the `completed` response
- [ ] 1.2 `uploadStatus.ts`: add the same to the `failed` response
- [ ] 1.3 `processing` responses unchanged (no `durationMs` field — the job hasn't finished)

## 2. Backend: Tests (TDD)

- [ ] 2.1 `completed` response includes `durationMs` computed from `finishedOn - timestamp`
- [ ] 2.2 `failed` response includes `durationMs`
- [ ] 2.3 `processing` response has no `durationMs` field

## 3. Frontend: Data Layer and UI

- [ ] 3.1 `useCvExtractionStatus.ts`: add `durationMs?: number` to the type
- [ ] 3.2 `UploadStatusIndicator.tsx`: a small formatter (`< 60s` → "N seconds", `>= 60s` → "Nm Ss") and display it in the success message
- [ ] 3.3 Failure message unchanged (duration deliberately not shown there, per design.md)

## 4. Frontend: Review and Update Existing Unit Tests (MANDATORY)

- [ ] 4.1 Update the existing "shows a success state on completion" test if its assertion would otherwise conflict with the new duration text
- [ ] 4.2 Add cases: duration under a minute, duration over a minute, success with no `durationMs` (fallback — message still renders without a duration clause)

## 5. Run Unit Tests and Verify (MANDATORY)

- [ ] 5.1 Run the full local suite (Jest backend/, pytest backend/, Vitest frontend/) — confirm green
- [ ] 5.2 Both builds clean, lint/format clean
- [ ] 5.3 Create verification report at `openspec/changes/cv-extraction-duration/specs/cv-extraction-status/reports/YYYY-MM-DD-step-5-unit-test-verification.md`

## 6. Manual Endpoint Testing with curl (MANDATORY)

- [ ] 6.1 Upload a real CV, wait for completion, confirm `durationMs` in the response is a plausible positive number matching the observed wall-clock wait
- [ ] 6.2 Document in the same report as step 5

## 7. E2E Testing with Playwright MCP (MANDATORY — this change has a real UI)

- [ ] 7.1 Upload a CV in the browser and confirm the success message shows a duration
- [ ] 7.2 Document with a screenshot or transcript in the same report as step 5

## 8. Close Out

- [ ] 8.1 Push branch, open PR (required — `main` is protected)
- [ ] 8.2 Confirm all three CI checks pass and the PR is mergeable
- [ ] 8.3 Merge once steps 5-7 pass and the project owner confirms explicitly
- [ ] 8.4 Propose `openspec archive cv-extraction-duration` per the project's standard change lifecycle

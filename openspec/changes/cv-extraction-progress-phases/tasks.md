## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [x] 0.1 Created feature branch `feature/cv-extraction-progress-phases` from `main`
- [x] 0.2 Verified current branch

## 1. Backend: Worker Progress Reporting

- [x] 1.1 `job.updateProgress({ phase: "extracting" })` before `callAgent()`
- [x] 1.2 `job.updateProgress({ phase: "saving" })` before `prisma.$transaction(...)`

## 2. Backend: Status Endpoint

- [x] 2.1 `waiting`/`delayed` → `phase: "queued"`
- [x] 2.2 `active` → reads `job.progress`, defaults to `"extracting"` if unset
- [x] 2.3 `completed`/`failed` unchanged (no `phase` field)

## 3. Backend: Tests (TDD)

- [x] 3.1 `waiting`/`delayed` → `phase: "queued"`
- [x] 3.2 `active` with `progress: { phase: "saving" }` → `phase: "saving"`
- [x] 3.3 `active` with no progress set → defaults to `phase: "extracting"`
- [x] 3.4 `completed`/`failed` responses have no `phase` field
- [x] 3.5 `updateProgress` called with `{phase: "extracting"}` then `{phase: "saving"}`, in order

## 4. Frontend: Data Layer and UI

- [x] 4.1 `useCvExtractionStatus.ts`: `phase?` added to the type
- [x] 4.2 `UploadStatusIndicator.tsx`: phase-specific copy, generic fallback when absent

## 5. Frontend: Review and Update Existing Unit Tests (MANDATORY)

- [x] 5.1 Added cases for queued/extracting/saving copy and the no-phase fallback
- [x] 5.2 Confirmed the existing "shows a processing indicator" test still passes unchanged (fallback text still matches `/processing/i`)

## 6. Run Unit Tests and Verify (MANDATORY)

- [x] 6.1 Full local suite green: 84 Jest, pytest unaffected, 57 Vitest
- [x] 6.2 Both builds clean
- [x] 6.3 Verification report: `openspec/changes/cv-extraction-progress-phases/specs/cv-extraction-status/reports/2026-09-05-step-6-8-verification.md`

## 7. Manual Endpoint Testing with curl (MANDATORY)

- [x] 7.1 Uploaded a real CV, polled repeatedly
- [x] 7.2 `phase: "extracting"` confirmed reliably over ~40s; `saving`/`queued` too fast to catch manually (expected, covered by unit tests)
- [x] 7.3 Documented in the step 6 report

## 8. E2E Testing with Playwright MCP (MANDATORY — this change has a real UI)

- [x] 8.1 Verified in-browser (via a JS-dispatched file input, working around the sandbox's native-picker limitation) that the UI text changes to the extracting-phase copy
- [x] 8.2 Documented in the step 6 report

## 9. Close Out

- [ ] 9.1 Push branch, open PR (required — `main` is protected)
- [ ] 9.2 Confirm all three CI checks pass and the PR is mergeable
- [ ] 9.3 Merge once steps 6-8 pass and the project owner confirms explicitly
- [ ] 9.4 Propose `openspec archive cv-extraction-progress-phases` per the project's standard change lifecycle

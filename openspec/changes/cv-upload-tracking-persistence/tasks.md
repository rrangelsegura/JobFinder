## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [x] 0.1 Create feature branch `feature/cv-upload-tracking-persistence` from `main`
- [x] 0.2 Verify branch creation and current branch status

## 1. Frontend: Storage Helper

- [x] 1.1 Add `frontend/src/features/upload/cvUploadJobStorage.ts`: `getStoredJobId(candidateId)` and `setStoredJobId(candidateId, jobId)`, keyed `cv-extraction-job:{candidateId}`, both wrapped in `try/catch` (private browsing / storage disabled degrades to no persistence, not a crash)

## 2. Frontend: Tests (TDD)

- [x] 2.1 `getStoredJobId`/`setStoredJobId` round-trip for a given candidate id
- [x] 2.2 `getStoredJobId` returns `null` for a candidate id with nothing stored
- [x] 2.3 Two different candidate ids never see each other's stored job id
- [x] 2.4 A `localStorage` access that throws (simulated) is swallowed, not propagated

## 3. Frontend: Wire into UploadPage

- [x] 3.1 `UploadPage.tsx`: read `candidateId` from `useSession()`
- [x] 3.2 Rehydrate `jobId` from storage in an effect keyed on `candidateId` once it resolves
- [x] 3.3 Persist newly-tracked job ids through the storage helper alongside the existing `setJobId` call

## 4. Frontend: Review and Update Existing Unit Tests (MANDATORY)

- [x] 4.1 Review `UploadPage.test.tsx` for assertions that would break once mount reads `localStorage`/`useSession` for a candidate id (mock as needed)
- [x] 4.2 Add a case: mounting with a `jobId` already in storage for the current candidate renders that job's tracked status immediately, without requiring a new upload

## 5. Run Unit Tests and Verify (MANDATORY)

- [x] 5.1 Run the full local suite (Jest backend/, pytest backend/, Vitest frontend/) — confirm green (this change touches frontend only, so backend/pytest are regression checks)
- [x] 5.2 Both builds clean, lint/format clean
- [x] 5.3 Create verification report at `openspec/changes/cv-upload-tracking-persistence/specs/cv-upload-ui/reports/YYYY-MM-DD-step-5-unit-test-verification.md`

## 6. E2E Testing with Playwright MCP (MANDATORY — this change has a real UI)

- [x] 6.1 Upload a CV, navigate to Analysis Results while it's still processing, navigate back to Upload — confirm it resumes showing the job's status (not the empty form)
- [x] 6.2 Upload a CV, navigate away, wait for it to complete in the background, navigate back to Upload — confirm it shows the success message with duration, not the empty form
- [x] 6.3 Document with a screenshot or transcript in the same report as step 5

## 7. Close Out

- [ ] 7.1 Push branch, open PR (required — `main` is protected)
- [ ] 7.2 Confirm all three CI checks pass and the PR is mergeable
- [ ] 7.3 Merge once steps 5-6 pass and the project owner confirms explicitly
- [ ] 7.4 Propose `openspec archive cv-upload-tracking-persistence` per the project's standard change lifecycle

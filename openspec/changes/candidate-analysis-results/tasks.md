## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [x] 0.1 Created feature branch `feature/candidate-analysis-results` from `main`
- [x] 0.2 Verified current branch

## 1. Backend: Endpoint

- [x] 1.1 Created `backend/api/routes/candidates.ts` with `GET /candidates/me`, mounted behind `requireAuth`
- [x] 1.2 Prisma query: candidate's `educations`, `workExperiences` (with `responsibilities`, `projects` including `achievements`/`stack`), `skills`, `languages`, `certifications`; separately, most recent `resume` with non-null `extractedFirstName`
- [x] 1.3 Response shape: `{ hasAnalysis, personalInfo?, education, workExperience, skills, languages, certifications }` in the standard envelope
- [x] 1.4 `hasAnalysis: false` short-circuits before querying the structured tables
- [x] 1.5 Mounted in `backend/api/app.ts`

## 2. Backend: Tests (TDD)

- [x] 2.1 401 when unauthenticated
- [x] 2.2 `hasAnalysis: false` when candidate has zero resumes
- [x] 2.3 `hasAnalysis: false` when the only resume hasn't completed extraction
- [x] 2.4 `hasAnalysis: true` with full nested data
- [x] 2.5 Personal info comes from the most recent resume with completed extraction

## 3. Frontend: Data Layer

- [x] 3.1 `frontend/src/features/analysis/useAnalysisResults.ts`
- [x] 3.2 TypeScript types for the response shape

## 4. Frontend: UI

- [x] 4.1 `AnalysisResultsPage.tsx` — loading, empty (links to Upload), populated states
- [x] 4.2 All sections render: Personal Info, Education, Work Experience (responsibilities + project sub-cards with achievements/stack), Skills, Languages, Certifications
- [x] 4.3 No edit controls anywhere (confirmed in tests and browser verification)

## 5. Frontend: Wire In

- [x] 5.1 `/workspace/analysis` route added
- [x] 5.2 "Analysis Results" removed from `DISABLED_SECTIONS`, rendered as a real `NavLink`

## 6. Frontend: Review and Update Existing Unit Tests (MANDATORY)

- [x] 6.1 `WorkspaceLayout.test.tsx` updated: Analysis Results is now a live-link test; disabled-sections test covers only Chat/Action Plan ("coming soon" count 3 → 2)
- [x] 6.2 Confirmed no other existing test asserted on the old disabled state

## 7. Backend + Frontend: New Unit Tests (MANDATORY)

- [x] 7.1 Empty state renders and links to Upload
- [x] 7.2 Populated state renders all section data
- [x] 7.3 No edit control rendered anywhere

## 8. Run Unit Tests and Verify (MANDATORY)

- [x] 8.1 Full local suite green: 79 Jest, 78 pytest, 53 Vitest
- [x] 8.2 Both builds (backend, frontend) clean
- [x] 8.3 Verification report: `openspec/changes/candidate-analysis-results/specs/candidate-analysis-results/reports/2026-09-05-step-8-10-verification.md`

## 9. Manual Endpoint Testing with curl (MANDATORY)

- [x] 9.1 Unauthenticated → 401
- [x] 9.2 Fresh candidate, no upload → `hasAnalysis: false`
- [x] 9.3 After a real CV upload completes → `hasAnalysis: true` with correct nested data
- [x] 9.4 Documented in the step 8 report

## 10. E2E Testing with Playwright MCP (MANDATORY — this change has a real UI)

- [x] 10.1 Empty state verified in-browser (fresh candidate, no upload)
- [x] 10.2 Populated state verified in-browser, matching Postgres data
- [x] 10.3 Live nav link confirmed; no edit controls confirmed
- [x] 10.4 Documented in the step 8 report, including a real bug found and fixed during this step (date-range timezone display — `getFullYear()` → `getUTCFullYear()`)

## 11. Update Technical Documentation (MANDATORY)

- [x] 11.1 `docs/api-spec.yml`: added the real `GET /candidates/me` path

## 12. Close Out

- [ ] 12.1 Push branch, open PR (required — `main` is protected)
- [ ] 12.2 Confirm all three CI checks pass and the PR is mergeable
- [ ] 12.3 Merge once steps 8-10 pass and the project owner confirms explicitly
- [ ] 12.4 Propose `openspec archive candidate-analysis-results` per the project's standard change lifecycle

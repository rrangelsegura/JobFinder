## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [ ] 0.1 Create feature branch `feature/candidate-analysis-results` from `main`
- [ ] 0.2 Verify branch creation and current branch status

## 1. Backend: Endpoint

- [ ] 1.1 Create `backend/api/routes/candidates.ts` with `GET /candidates/me`, mounted behind `requireAuth`
- [ ] 1.2 Prisma query: candidate's `educations`, `workExperiences` (with `responsibilities`, `projects` including `achievements`/`stack`), `skills`, `languages`, `certifications`; separately, most recent `resume` with non-null `extractedFirstName` for personal info
- [ ] 1.3 Response shape: `{ hasAnalysis: boolean, personalInfo?, education, workExperience, skills, languages, certifications }` inside the project's standard `{status, data, agent_trace_id, model_used}` envelope
- [ ] 1.4 `hasAnalysis: false` short-circuits to an empty-shaped response (no need to query the structured tables if no resume has completed extraction — though correctness doesn't depend on skipping it, it avoids pointless queries)
- [ ] 1.5 Mount the new router in `backend/api/index.ts` alongside `auth`/`uploads`/`uploadStatus`

## 2. Backend: Tests (TDD)

- [ ] 2.1 `candidates.test.ts`: 401 when unauthenticated
- [ ] 2.2 `candidates.test.ts`: `hasAnalysis: false` when candidate has zero resumes
- [ ] 2.3 `candidates.test.ts`: `hasAnalysis: false` when the candidate's only resume has `extractedFirstName: null` (still processing/failed)
- [ ] 2.4 `candidates.test.ts`: `hasAnalysis: true` with full nested data (education, work experience with responsibilities/projects/achievements/stack, skills with proficiency, languages, certifications) for a populated candidate
- [ ] 2.5 `candidates.test.ts`: personal info comes from the most recent resume with non-null `extractedFirstName`, not an older or still-processing one

## 3. Frontend: Data Layer

- [ ] 3.1 `frontend/src/features/analysis/useAnalysisResults.ts` — TanStack Query hook, `GET /candidates/me`, mirrors `useCvExtractionStatus`'s shape (no polling needed — this isn't watching an in-flight job)
- [ ] 3.2 TypeScript types for the response shape

## 4. Frontend: UI

- [ ] 4.1 `frontend/src/features/analysis/AnalysisResultsPage.tsx` — loading state, empty state (`hasAnalysis: false`, links to `/workspace/upload`), populated state
- [ ] 4.2 Populated state renders sections: Personal Info, Education, Work Experience (each entry's responsibilities as a list, projects as sub-cards with achievements/stack), Skills (name + type + proficiency when present), Languages, Certifications
- [ ] 4.3 No edit controls anywhere on the page (read-only, per design.md Non-Goals)

## 5. Frontend: Wire In

- [ ] 5.1 `frontend/src/routes/router.tsx`: add `/workspace/analysis` under the existing `ProtectedRoute`/`WorkspaceLayout` subtree
- [ ] 5.2 `WorkspaceLayout.tsx`: remove "Analysis Results" from `DISABLED_SECTIONS`, render it as a real `NavLink` to `/workspace/analysis`

## 6. Frontend: Review and Update Existing Unit Tests (MANDATORY)

- [ ] 6.1 `WorkspaceLayout.test.tsx`: update "shows all four navigation sections" / disabled-sections tests — Analysis Results is now a live link, only Chat and Action Plan are disabled ("coming soon" count 3 → 2)
- [ ] 6.2 Confirm no other existing test asserts on the old disabled-Analysis-Results state

## 7. Backend + Frontend: New Unit Tests (MANDATORY)

- [ ] 7.1 `AnalysisResultsPage.test.tsx`: empty state renders and links to Upload
- [ ] 7.2 `AnalysisResultsPage.test.tsx`: populated state renders education/work experience/skills/languages/certifications data
- [ ] 7.3 `AnalysisResultsPage.test.tsx`: no edit control (e.g. no button/input) is rendered anywhere on the page

## 8. Run Unit Tests and Verify (MANDATORY)

- [ ] 8.1 Run the full local suite (Jest backend/, pytest backend/, Vitest frontend/) — confirm green
- [ ] 8.2 `npm run build` (backend and frontend) — confirm clean
- [ ] 8.3 Create verification report at `openspec/changes/candidate-analysis-results/specs/candidate-analysis-results/reports/YYYY-MM-DD-step-8-unit-test-verification.md`

## 9. Manual Endpoint Testing with curl (MANDATORY)

- [ ] 9.1 With the docker-compose stack running, `curl` `/candidates/me` unauthenticated → 401
- [ ] 9.2 Register/verify/login a fresh candidate, `curl` `/candidates/me` before uploading → `hasAnalysis: false`
- [ ] 9.3 Upload a real CV, wait for extraction to complete, `curl` `/candidates/me` again → `hasAnalysis: true` with full nested data matching what's in Postgres
- [ ] 9.4 Document commands and responses in the same report as step 8

## 10. E2E Testing with Playwright MCP (MANDATORY — this change has a real UI)

- [ ] 10.1 Load the Analysis Results page in a browser for a candidate with no data yet — confirm the empty state and the link to Upload
- [ ] 10.2 Load it for a candidate with completed extraction — confirm all sections render the expected data, matching what's in Postgres
- [ ] 10.3 Confirm the nav item is a real link (not disabled) and no edit control exists anywhere on the page
- [ ] 10.4 Document with a screenshot or transcript in the same report as step 8

## 11. Update Technical Documentation (MANDATORY)

- [ ] 11.1 `docs/api-spec.yml`: add the real `GET /candidates/me` path

## 12. Close Out

- [ ] 12.1 Push branch, open PR (required — `main` is protected)
- [ ] 12.2 Confirm all three CI checks pass and the PR is mergeable
- [ ] 12.3 Merge once steps 8-10 pass and the project owner confirms explicitly
- [ ] 12.4 Propose `openspec archive candidate-analysis-results` per the project's standard change lifecycle

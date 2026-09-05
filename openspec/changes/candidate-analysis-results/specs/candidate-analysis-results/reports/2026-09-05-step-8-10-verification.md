# Step 8-10 Report - Unit Tests, Manual, and Browser Verification

- Date: 2026-09-05
- Change: candidate-analysis-results
- Agent: Claude (Sonnet 5)

## Unit Test Results
- Jest (backend/): 79 passed (74 baseline + 5 new `candidates.test.ts`)
- Pytest (backend/): 78 passed (unaffected, no Python changes)
- Vitest (frontend/): 53 passed (49 baseline + 4 new/updated: 3 `AnalysisResultsPage.test.tsx`, 1 `WorkspaceLayout.test.tsx` split into two)
- Frontend lint: clean (1 pre-existing warning, unrelated)
- Backend build (tsc) and frontend build (tsc + vite): both clean

## Manual Endpoint Testing (curl)
- `GET /candidates/me` unauthenticated → `401 {"error":"Not authenticated."}`
- Registered/verified/logged in a fresh candidate (`analysis-test@jobfinder.dev`); `GET /candidates/me` before any upload → `{"hasAnalysis":false}`
- Uploaded `backend/api/routes/__fixtures__/realistic-cv.pdf`, waited for extraction to complete, `GET /candidates/me` again → `hasAnalysis: true` with full nested data (personal info, 1 education entry, 1 work experience with a project, 3 skills, 2 languages) — matches what the extraction produced exactly.

## Browser (Playwright MCP) Verification
- Logged in as `analysis-test@jobfinder.dev` (has completed extraction): "Analysis Results" renders as a real nav link (`href="/workspace/analysis"`, no longer "Coming soon"). Page renders all sections: Personal Info, Education, Work Experience (with its project), Skills, Languages. No certifications section rendered (empty list correctly hidden).
- **Bug found and fixed during this verification**: date ranges initially showed one year too early (e.g. "1839 – 1842" instead of "1840 – 1843") — `new Date(iso).getFullYear()` reads the local timezone, and the stored dates are midnight-UTC with no meaningful time component, so a negative UTC offset rolls the calendar date back a day and the year with it. Fixed by using `getUTCFullYear()` instead; re-verified in the browser afterward and the correct years ("1840 – 1843", "1843 – Present") now render.
- Registered a second fresh candidate (`analysis-empty@jobfinder.dev`) with no CV uploaded: page correctly shows "No analysis available yet. Upload a CV to get started." with a working "Go to Upload" link, instead of empty sections.
- Confirmed no edit control (button, input, or textarea) exists anywhere on the populated page, per the read-only requirement.

## Outcome
- Steps 8, 9, 10 status: **PASS**
- One real bug found and fixed during browser verification (timezone-related date display), re-tested and confirmed corrected.
- Blocking issues: none

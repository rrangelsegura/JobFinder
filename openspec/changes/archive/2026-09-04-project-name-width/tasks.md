## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [x] 0.1 Branch `feature/project-name-width` already existed (created before this proposal, holding the unsynced migration) — fast-forwarded to current `main` and confirmed no unique commits were lost
- [x] 0.2 Verified current branch is `feature/project-name-width`

## 1. Schema and Docs

- [x] 1.1 Updated `backend/prisma/schema.prisma`: `Project.name` → `@db.VarChar(300)`
- [x] 1.2 Updated `docs/data-model.md`: "max 150" → "max 300" (description + validation rule)
- [x] 1.3 Confirmed: migration SQL is `VARCHAR(300)`, matches the schema now

## 2. Backend: Review and Update Existing Unit Tests (MANDATORY)

- [x] 2.1 Grepped for `150` across `backend/**/*.test.ts` — only match was an unrelated 15000ms Jest timeout; no test asserts the old limit
- [x] 2.2 Confirmed: `cvExtractionProcessor.test.ts` and `test_extraction_service.py` need no changes

## 3. Backend: Run Unit Tests and Verify Database State (MANDATORY)

- [x] 3.1 `npx prisma generate` succeeded
- [x] 3.2 Full local suite green: 71 Jest, 59 pytest, 49 Vitest — no regressions
- [x] 3.3 `npm run build` (backend) clean
- [x] 3.4 Verification report: `openspec/changes/project-name-width/specs/cv-extraction/reports/2026-09-03-step-3-unit-test-and-db-verification.md`

## 4. Manual Endpoint Testing with curl — NOT APPLICABLE

- [x] 4.1 Marked N/A: this change adds no new HTTP endpoint; the existing upload/extraction endpoints are unaffected in shape, only a column's max length changes

## 5. E2E Testing with Playwright MCP — NOT APPLICABLE

- [x] 5.1 Marked N/A: no user-facing UI renders `Project.name` yet (per `frontend/README.md`'s "known limitations" — Analysis Results is still a disabled placeholder)

## 6. Close Out

- [x] 6.1 Pushed branch, opened [PR #9](https://github.com/rrangelsegura/JobFinder/pull/9)
- [x] 6.2 All three CI checks passed; PR reached `mergeStateStatus: CLEAN`
- [x] 6.3 Merged into `main` (merge commit `5b24f99`), owner confirmed explicitly
- [x] 6.4 Archiving via `openspec archive project-name-width`

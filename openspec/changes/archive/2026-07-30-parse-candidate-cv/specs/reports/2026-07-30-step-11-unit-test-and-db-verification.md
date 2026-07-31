# Step 11 Report - Unit Tests and Database Verification

- Date: 2026-07-30
- Change: parse-candidate-cv
- Agent: Claude (Sonnet 5)

## Commands Executed

- `npx jest api/routes/uploads.test.ts api/routes/uploadStatus.test.ts api/queue/cvExtractionProcessor.test.ts` (targeted Node)
- `./.venv/Scripts/python -m pytest agents/cv_analyst knowledge_base -v` (targeted Python)
- `npx jest` (full Node suite)
- `./.venv/Scripts/python -m pytest` (full Python suite)
- `npx tsc --noEmit` (type check)
- `docker exec infra-postgres-1 psql -U jobfinder -d jobfinder -c "SELECT ... FROM <table>"` for all 7 candidate-domain tables, run before and after the test runs

## Unit Test Results

- Targeted tests: 34 passed, 0 failed, 0 skipped (18 Jest + 16 Pytest)
- Full/required suite: 34 passed, 0 failed, 0 skipped — identical to targeted, since no other modules exist yet in this greenfield backend
- TypeScript: `tsc --noEmit` reports no type errors
- Runtime: Jest ~3.7s, Pytest ~0.7s
- Notes: no flaky tests observed across repeated runs during this change (ran the suite 4+ times over the session while iterating)

### Coverage review against specs (task group 10)

Cross-checked all 20 scenarios across `specs/cv-upload/spec.md`, `specs/cv-extraction-status/spec.md`, `specs/cv-extraction/spec.md` against the actual test files. Found and closed one real gap: the "Extracted Field Coverage" requirement (CV with all field groups present / CV missing optional field groups) had no dedicated schema-level test — it was only exercised indirectly through retry-logic and embedding tests. Added `agents/cv_analyst/tests/test_schemas.py` (2 tests) to cover it directly.

One requirement — "Successful extraction persists structured data and embeddings" — is covered by two separate test files (`cvExtractionProcessor.test.ts` for the Prisma persistence half, `test_router.py` for the embedding-call half), which is expected given persistence is split across the Node/Python boundary per design.md Decision 0, not a gap.

## Database State Verification

- Pre-test baseline (all 7 candidate-domain tables): `candidates: 0, educations: 0, work_experiences: 0, resumes: 0, skills: 0, languages: 0, certifications: 0`
- Post-test validation: identical — `candidates: 0, educations: 0, work_experiences: 0, resumes: 0, skills: 0, languages: 0, certifications: 0`
- State restored: N/A (no mutation occurred — every test mocks `../prisma` / `agents/cv_analyst`'s dependencies rather than hitting the real Postgres container)
- Restoration actions (if any): None needed for the database. A **filesystem** side effect was found and fixed: `uploads.test.ts` does not mock `fs`, so it was writing real PDF files to `backend/uploads/cv/` on every run. Added an isolated `CV_UPLOAD_DIR` pointed at the OS temp directory plus an `afterAll` cleanup hook so repeated test runs no longer leave files in the repo working tree.

## Outcome

- Step 11 status: PASS
- Blocking issues: none

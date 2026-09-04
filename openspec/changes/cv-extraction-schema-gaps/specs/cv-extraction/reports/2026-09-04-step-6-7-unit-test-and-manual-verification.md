# Step 6/7 Report - Unit Tests, DB, and Manual Verification

- Date: 2026-09-04
- Change: cv-extraction-schema-gaps
- Agent: Claude (Sonnet 5)

## Commands Executed
- `pytest agents/cv_analyst/tests/` then full `pytest -q` (backend/)
- `npm test` (backend/) — Jest
- `npm test` (frontend/) — Vitest
- `npx prisma migrate dev --name cv_extraction_schema_gaps` (against the local docker-compose Postgres, port 5433)
- `npm run build` (backend/)
- `docker compose exec backend-api npx prisma generate` + `docker compose restart backend-api`
- `docker compose restart backend-agent` (Python has no hot-reload — required to pick up schemas.py/extraction_service.py changes)
- `docker compose exec backend-api npx ts-node --transpile-only api/scripts/reprocessExistingResumes.ts` (re-enqueued both existing resumes, including the one that produced job 20's failure)

## Unit Test Results
- Pytest (backend/, cv_analyst only): 58 passed
- Pytest (backend/, full): 64 passed (59 baseline + 5 new: education-optional-start-date, skill-proficiency round-trip, skill-type-still-rejects-proficiency, worked-example demonstrates both new shapes, prompt explains type-vs-proficiency)
- Jest (backend/): 73 passed (71 baseline + 2 new: education with no start_date persists NULL, skill proficiency persists alongside type)
- Vitest (frontend/): 49 passed (unaffected, no frontend changes)
- Backend build (tsc): clean

## Database State Verification
- Migration `20260904193543_cv_extraction_schema_gaps` applied: `ALTER TABLE "educations" ALTER COLUMN "startDate" DROP NOT NULL;` and `ALTER TABLE "skills" ADD COLUMN "proficiency" VARCHAR(50);` — both additive/non-destructive, confirmed via migration SQL review before applying.
- Post-migration schema confirmed via `\d educations` / `\d skills` in psql: `startDate` now nullable, `proficiency` column present.

## Manual End-to-End Verification (real CV, not a fixture)
This is the exact CV that failed as job 20 during a live manual test session, with 18 Pydantic validation errors (12 `skills[N].type` enum violations from proficiency words like "advanced"/"intermediate"/"basic"/"scrum", 2 `education[N].start_date` being `null`).

- Re-enqueued via `reprocessExistingResumes.ts` (resume id 2, candidate id 4) after restarting `backend-agent` (required — no Python hot-reload).
- Extraction completed successfully: `resumes.extractedFirstName` populated, no failure logged.
- Verified in Postgres:
  - 18 `Skill` rows for candidate 4, all with a non-null `proficiency` (e.g. "SQL"/"Advanced", "Python"/"Intermediate", "Git"/"Basic") and `type: technical` — none with a proficiency word forced into `type`.
  - 2 `Education` rows for candidate 4, both with `startDate: NULL` (source CV states only a graduation year for both), `endDate` correctly populated.
- No errors in `backend-api`/`backend-agent` logs for this run.

## Outcome
- Step 6 status: **PASS**
- Step 7 status: **PASS** — the exact real-world failure this change targets is confirmed fixed against the actual CV that originally failed, not just a synthetic test case.
- Blocking issues: none

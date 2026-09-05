# Step 6/7 Report - Unit Tests, DB, and Manual Verification

- Date: 2026-09-05
- Change: work-experience-date-gaps
- Agent: Claude (Sonnet 5)

## Commands Executed
- `pytest agents/cv_analyst/tests/` then full `pytest -q` (backend/) — run repeatedly as the fix expanded (see below)
- `npm test` (backend/) — Jest
- `npm test` (frontend/) — Vitest
- `npx prisma migrate dev --name work_experience_date_gaps` (local docker-compose Postgres, port 5433)
- `npm run build` (backend/)
- `docker compose exec backend-api npx prisma generate` + `docker compose restart backend-api backend-agent`
- `docker compose exec backend-api npx ts-node --transpile-only api/scripts/reprocessExistingResumes.ts` (re-enqueued, including the resume that produced job 25's failure)

## Scope Grew During Manual Verification (documented, not hidden)
The original diagnosis (job 25: 8 work experience entries with no `start_date`, 2 `end_date`s as duration phrases) was fixed first. Re-running the exact same real CV then surfaced two more instances of the same underlying class of problem, one layer deeper each time — fixed in the same change rather than filed separately, since they're the same root cause (a date field receiving something that isn't a date) discovered via the same verification pass:
1. `certifications[0].issue_date = "40 horas"` (job 29) — the duration pattern didn't yet cover hours. Added `hours?|hrs?|horas?` to `_DURATION_ONLY_PATTERN`.
2. `education[N].end_date = "mayo, 2012"` (surfaced after the above fix) — the full Spanish month name, not the 3-letter abbreviation the existing translator already handled. Added full Spanish month names to `_SPANISH_MONTH_ALIASES`.

A third failure (`job 32: fetch failed`) was a transient race condition from restarting `backend-agent` and immediately re-enqueuing before it finished starting up — confirmed via `curl http://localhost:8000/docs` returning 200 before the successful retry; not a code issue.

## Unit Test Results
- Pytest (backend/, cv_analyst only): 72 passed (progressively: 70 after the initial fix, 71 after the hours fix, 72 after the Spanish full-month-name fix)
- Pytest (backend/, full): 78 passed
- Jest (backend/): 74 passed (73 baseline + 1 new: work experience with no start_date persists NULL)
- Vitest (frontend/): 49 passed (unaffected)
- Backend build (tsc): clean

## Database State Verification
- Migration `20260905152739_work_experience_date_gaps` applied: `ALTER TABLE "work_experiences" ALTER COLUMN "startDate" DROP NOT NULL;` — additive/non-destructive.

## Manual End-to-End Verification (the exact real CV that failed as job 25)
- Re-enqueued via `reprocessExistingResumes.ts` (resume id 4, candidate id 4) after each fix iteration, restarting `backend-agent` each time (no Python hot-reload).
- Final run completed successfully: `resumes.extractedFirstName = "Rene"`, no failure logged.
- Verified in Postgres:
  - `work_experiences` for candidate 4: 8 rows, including "Consultor Senior para Caracol Television" with both `startDate` and `endDate` NULL (the duration-only entry) — all others have real dates.
  - `certifications` for candidate 4: both rows have `issueDate` NULL (one was the "40 horas" duration; no failure).
  - `educations` for candidate 4: both rows have `startDate` NULL (not stated) and `endDate` correctly parsed — including `2012-05-01` from the source "mayo, 2012".

## Outcome
- Step 6 status: **PASS**
- Step 7 status: **PASS** — confirmed against the actual CV that originally failed, through three iterations of the same verification pass, not a single synthetic pass.
- Blocking issues: none

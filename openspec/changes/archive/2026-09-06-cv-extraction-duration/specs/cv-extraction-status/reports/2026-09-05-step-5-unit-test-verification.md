# Verification Report — cv-extraction-duration

Date: 2026-09-05

## Step 5: Unit Tests and Builds

### Backend (Node/Jest)

```
cd backend && npm test
```

Result: **12 test suites, 87 tests — all passed.**

New/updated tests in `api/routes/uploadStatus.test.ts` (13 tests in this
file, up from 10):
- `reports durationMs computed from finishedOn - timestamp on completion`
- `does not include durationMs while still processing`
- `reports durationMs computed from finishedOn - timestamp on failure`

The `console.error` output visible during the run comes from
`api/queue/handleExtractionFailure.test.ts`, which deliberately exercises
the failure-logging path — not a regression.

### Backend (Python/pytest)

```
cd backend && .venv/Scripts/python.exe -m pytest
```

Result: **78 passed.** No files in this change touch the Python agent, so
this run confirms no collateral regression only.

### Frontend (Vitest)

```
cd frontend && npx vitest run
```

Result: **16 test files, 60 tests — all passed.**

New/updated tests in `UploadStatusIndicator.test.tsx` (10 tests in this
file, up from 7):
- `shows the duration in seconds when under a minute`
- `shows the duration in minutes and seconds when over a minute`
- `shows the success message with no duration clause when durationMs is absent`

### Builds

- `cd backend && npm run build` — clean, no errors.
- `cd frontend && npm run build` — `tsc -b && vite build` clean, no errors.

### Lint / Format

`npx prettier --check` initially flagged `backend/api/routes/uploadStatus.ts`
and `backend/api/routes/uploadStatus.test.ts` (whitespace from the manual
edits). Fixed with `npx prettier --write` on those two files; a follow-up
`--check` across all six files touched by this change (the two backend
files plus `useCvExtractionStatus.ts`, `UploadStatusIndicator.tsx`,
`UploadStatusIndicator.test.tsx`, `UploadPage.tsx`) passed clean. Backend
tests re-run after formatting to confirm no behavior changed — still
13/13 in `uploadStatus.test.ts`.

## Step 6: Manual Endpoint Testing with curl

Rebuilt and recreated the `backend-api` container (`docker compose build
backend-api && docker compose up -d backend-api`) so the running image
picked up this change — it has no bind mount for hot reload.

Registered a temporary candidate (`duration-test@example.com`), verified
its email directly in Postgres (bypassing the email link to keep the test
self-contained), logged in for a session cookie, then uploaded the
`realistic-cv.pdf` fixture used by existing route tests
(`backend/api/routes/__fixtures__/realistic-cv.pdf`) via
`POST /uploads/cv`.

- Upload observed at `t=1788648988` (unix seconds).
- Polled `GET /uploads/cv/43` every 5s; `phase: "extracting"` reported
  through `t=1788649020`.
- Completed by the poll at `t=1788649025`, with:
  ```json
  { "status": "completed", "candidate": { ... }, "durationMs": 34995 }
  ```

`durationMs` (34995ms ≈ 35s) lands exactly inside the observed 32–37s
wall-clock window between upload and the completed poll — a plausible,
correctly-computed positive number, confirming `finishedOn - timestamp`
behaves as designed against a real extraction run (not just mocked BullMQ
jobs in the unit tests).

Cleaned up afterward: deleted the temporary candidate and all cascaded
rows (work experience, education, skills, languages, resume) from
Postgres; no test data left behind.

## Step 7: E2E Testing with Playwright MCP

Used the already-running `frontend` dev server (Vite, port 5173) and the
existing `analysis-empty@jobfinder.dev` session in the Browser MCP tab.
Injected `realistic-cv.pdf` into the native file input via the
established `File`/`DataTransfer` + synthetic `change` event workaround
(native pickers can't be driven through `form_input`), then clicked
"Upload CV".

- Immediately showed "Analyzing your CV — this can take a few minutes…"
  (existing phase copy, unaffected by this change).
- ~21s later, the success message read:
  **"Your CV was processed successfully. (took 21 seconds)"**
  — confirmed via `get_page_text` and a screenshot.

This is the under-a-minute formatting branch (`"N seconds"`); the
over-a-minute branch (`"Nm Ss"`) and the no-`durationMs` fallback are
covered by the `UploadStatusIndicator.test.tsx` unit tests (step 5) since
they need durations no manual run would produce or a state (a stale
in-flight job) not reproducible on demand in the browser.

Cleaned up afterward: this upload replaced `analysis-empty@jobfinder.dev`'s
extracted data (candidate-level "replace, not accumulate" persistence) —
deleted the newly-created work experience/education/skills/languages rows
and the new resume record to restore that account's prior empty state, so
it stays usable as the Analysis Results "empty state" fixture.

## Outcome

Steps 5, 6, and 7 all **PASS**. No blocking issues. This change is ready
to commit, push, and open as a PR.

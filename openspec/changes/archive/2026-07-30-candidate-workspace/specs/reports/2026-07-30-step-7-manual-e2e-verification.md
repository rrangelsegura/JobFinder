# Step 7: Manual / E2E Verification

**Change:** `candidate-workspace`
**Date:** 2026-07-30
**Scope:** `frontend/e2e/` — real browser, real backend stack, real PDF, no mocked HTTP.

## Environment

- Backend stack: `infra/docker-compose.yml` (`postgres`, `redis`, `chroma`, `backend-api`, `backend-agent`) — already running from `parse-candidate-cv`, health-checked directly before use.
- A real `Candidate` row (`id: 1`) was inserted directly into Postgres for this run, since registration (`US-003`) doesn't exist yet: `INSERT INTO candidates ("firstName", "lastName", email) VALUES ('E2E', 'Candidate', 'e2e-candidate@example.com')`. This id matches `useSession.mock.ts`'s `MOCK_SESSION_FIXTURE.candidateId`.
- Frontend dev server: `npm run dev` (Vite, port 5173).
- Browser: Playwright + Chromium (`npx playwright install chromium`).
- CV fixture: `openspec/changes/archive/2026-07-30-parse-candidate-cv/specs/reports/golden-dataset/golden-01-lovelace.pdf` — a real PDF already proven to extract successfully during `parse-candidate-cv`'s golden-dataset eval.

## Commands Run

```bash
cd frontend
npx playwright install chromium
npx vite --port 5173 &
npx playwright test --project=chromium
```

## A Real Bug Was Found and Fixed

The first run of `e2e/cv-upload.spec.ts` failed: the upload silently never left the form state (no processing indicator ever appeared). Investigation with a raw CORS preflight (`curl -X OPTIONS http://localhost:3000/uploads/cv -H "Origin: http://localhost:5173" ...`) showed **no `Access-Control-Allow-Origin` header at all** — `backend-api` had no CORS middleware, because `frontend/` is the first browser-based client this API has ever had (nothing exercised cross-origin requests during `parse-candidate-cv`, which was tested via `curl` and Jest/Supertest only).

Fix: added `cors` (`npm install cors`, `npm install -D @types/cors` in `backend/`) and wired it into `backend/api/app.ts`:

```ts
const ALLOWED_ORIGINS = (
  process.env.CORS_ALLOWED_ORIGINS ?? "http://localhost:5173"
).split(",");

app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
```

`credentials: true` is forward-looking for `US-003`'s cookie-based session — `frontend/src/lib/apiClient.ts` already sends `withCredentials: true`. Rebuilt and restarted the `backend-api` container (`docker compose build backend-api && docker compose up -d backend-api`); verified the preflight response now includes `Access-Control-Allow-Origin: http://localhost:5173` before re-running the E2E test.

This is exactly the kind of gap this project's real-testing discipline (established in `parse-candidate-cv`'s Group 12) exists to catch — a mocked-HTTP test would never have surfaced a browser-enforced CORS policy.

## Scenario 7.2: Upload flow, mock auth, real backend

`e2e/cv-upload.spec.ts` — **PASS** (21.3s)

1. Navigate to `/workspace/upload` (mock `useSession` auto-authenticates as candidate 1).
2. Select the real golden-dataset PDF, submit.
3. Observe `role="status"` text matching `/processing/i`.
4. Observe `role="status"` text matching `/success|complete/i` — no page reload, no manual re-check (TanStack Query polling per design.md Decision 2).

**Database verified directly** (not just the UI's claim of success):

```sql
SELECT id, "firstName", "lastName", email FROM candidates WHERE id = 1;
--  1 | Ada | Lovelace | ada.lovelace@example.com
SELECT id, title, institution FROM educations WHERE "candidateId" = 1;
--  1 | Mathematics | University of Cambridge
--  2 | Mathematics | University of Cambridge
```

The extraction agent's real output overwrote the placeholder candidate row with Ada Lovelace's actual extracted data and created her education records — confirming the full pipeline (upload → BullMQ job → Python agent → OCR/LLM extraction → Prisma transaction) ran for real, not just that the frontend rendered a success string.

## Scenario 7.3: Unauthenticated redirect

`e2e/unauthenticated-redirect.spec.ts` — **PASS** (0.8s)

The mock auth adapter normally auto-authenticates on mount (local-dev convenience per design.md Decision 1), which made this scenario untestable in a real browser as originally written. Added a real-browser escape hatch to `useSession.mock.ts`: the query param `?mockSession=unauthenticated` skips the auto-login and calls `setUnauthenticated()` instead. Does not change default mock behavior (no unit test regressed — `useSession.mock.test.ts` still passes unchanged).

1. Navigate to `/workspace/upload?mockSession=unauthenticated`.
2. Assert URL redirected to `/login`.
3. Assert the login stub page is shown, not the workspace.

## Result Summary

```
Running 2 tests using 2 workers
✓ unauthenticated-redirect.spec.ts (838ms)
✓ cv-upload.spec.ts (21.3s / 26.7s across runs)
2 passed
```

## Task 7.5: Explicitly Blocked (not silently skipped)

**Full-stack E2E with a real login against real `/auth/*` endpoints cannot be executed.** `US-003` (Candidate Authentication) has not been proposed or implemented as an OpenSpec change — there is no `POST /auth/login`, no `GET /auth/session`, no session cookie to test against. `useSession.live.ts` exists (design.md Decision 1) and is written against `US-003`'s documented contract, but is not genuinely exercisable until that change ships.

This is a known, documented gap in this change's verification — not marked done by proxy via the mock adapter. The mock-based tests above (7.2, 7.3) verify everything this change actually owns (workspace shell, upload flow, route protection against the `useSession()` boundary); they do not and cannot verify `US-003`'s real authentication mechanics.

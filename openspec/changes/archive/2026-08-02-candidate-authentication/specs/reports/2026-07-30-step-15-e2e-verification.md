# Step 15: Full-Stack E2E Verification

**Change:** `candidate-authentication`
**Date:** 2026-07-30
**Environment:** `infra/docker-compose.yml` (real Postgres, Redis, backend-agent, Chroma, maildev) + `frontend` dev server (`npm run dev`, port 5173).

## Commands Run

```bash
docker exec infra-backend-api-1 npx prisma generate
docker compose restart backend-api
npx vite --port 5173 &
npx playwright test --project=chromium
```

## Scenarios

### 15.2/15.3/15.5 — register → login → upload → completion → logout

`e2e/auth-flow.spec.ts` — **PASS** (33.5s, after fixes below)

1. Register a new candidate with a unique email.
2. Redirected to `/login`; log in with the same credentials.
3. Reach `/workspace/upload` (real session cookie, real `GET /auth/session`).
4. Upload a real PDF (`golden-03-hopper.pdf`) — no `candidateId` in the request body.
5. Observe `processing` → `completed`.
6. Log out — redirected to `/login`.
7. Navigate to `/workspace/upload` again — redirected to `/login` (session genuinely gone, not just client-side state).

**Database verified directly**, not just the UI:
```sql
SELECT id, email, "firstName", "lastName" FROM candidates;
--  9 | e2e-...@example.com | New | Candidate    (unchanged — login identity untouched)
SELECT id, "candidateId", "extractedFirstName", "extractedLastName", "extractedEmail" FROM resumes;
--  7 | 9 | Grace | Hopper | grace.hopper@example.com   (CV content, correctly resume-scoped)
```

### 15.4 — wrong password generic error

`e2e/auth-flow.spec.ts` — **PASS** (0.7-0.9s). Logging in with a nonexistent email and a wrong password both render the identical `"Invalid email or password"` alert.

### Unauthenticated redirect (regression, `candidate-workspace`)

`e2e/unauthenticated-redirect.spec.ts` — **PASS**. Simplified now that `useSession()` defaults to `live`: a fresh browser context with no cookie exercises the real `GET /auth/session` → `401` → redirect path directly, no `?mockSession=unauthenticated` escape hatch needed.

## Two Real Bugs Found and Fixed

Both were invisible to every mocked unit/component test in this codebase — only a real browser, a real backend, and a real Postgres database surfaced them.

### 1. Login race condition — `ProtectedRoute` bounced a freshly-authenticated candidate back to `/login`

First run of the main flow got through registration and login but landed back on the login page instead of the workspace. Root cause: `useSession.live.ts` derived `isAuthenticated` from a Zustand store populated by a `useEffect` reacting to the session query — one render behind the query itself resolving. `ProtectedRoute` could read `{isLoading: false, isAuthenticated: false}` in that gap and redirect, even though the session had actually just succeeded.

Fixed by deriving `candidateId`/`email`/`isAuthenticated` directly from the query result in the same render (`useSession.live.ts`); the `authStore` write is now purely a side-channel, not the source of truth for this hook's own return value. Added `useSession.live.test.tsx` — a regression test asserting no render ever reports `isLoading:false` with `isAuthenticated:false` once a valid session resolves; it reproduced the bug against the pre-fix code (RED) before the fix made it pass (GREEN).

### 2. CV extraction silently rewrote (and could crash on) the candidate's login email

Second run's extraction job never left "processing." `docker logs infra-backend-api-1` showed: `Unique constraint failed on the fields: (email)`. `cvExtractionProcessor.ts` (unchanged since `parse-candidate-cv`, which predates any login concept) was writing the CV's `personal_info.email` directly onto `Candidate.email` — now the login credential. Reusing the same golden-dataset PDF fixture across two different registered test accounts collided on `email`'s unique constraint and crashed the job.

Beyond the crash, the underlying behavior was itself wrong now that accounts exist: any successful upload could silently change what email a candidate logs in with. Fixed per design.md Decision 6 — extracted personal info (name, email, phone, address) now persists on the `Resume` record (`extractedFirstName`/`extractedLastName`/`extractedEmail`/`extractedPhone`/`extractedAddress`, new migration), never on `Candidate`. `UploadPage` now shows a non-blocking notice if the extracted email differs from the account email, instead of silently applying or silently dropping the difference. Verified directly in Postgres (above) that the login identity and the resume-reported identity are now independent.

## Cleanup

All test candidates and their cascaded records (educations, work experience, skills, languages, resumes) created during this step — including leftover rows from earlier failed attempts before the fixes — were deleted directly in Postgres. `candidates` count confirmed back to 0.

## Outcome

3/3 Playwright scenarios pass against the real stack. Two genuine bugs found via real E2E testing were fixed and covered by regression tests (unit-level for the race condition, existing + updated tests for the extraction persistence change). Frontend dev server stopped after verification.

## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [x] 0.1 Create feature branch `feature/candidate-authentication` from main
- [x] 0.2 Verify branch creation and current branch status

## 1. Data Model: `passwordHash`

- [x] 1.1 Add `Candidate.passwordHash` to `backend/prisma/schema.prisma`
- [x] 1.2 Generate and apply the Prisma migration
- [x] 1.3 Update `docs/data-model.md` with the new field

## 2. Backend: Session Storage (TDD)

- [x] 2.1 Write unit tests for `backend/api/lib/session.ts` (`createSession`, `getSession`, `deleteSession`): create-then-read round trip, TTL applied, delete makes a subsequent read miss
- [x] 2.2 Implement `backend/api/lib/session.ts`, reusing the `REDIS_HOST`/`REDIS_PORT` connection pattern from `backend/api/queue/cvExtractionQueue.ts`

## 3. Backend: `requireAuth` Middleware (TDD)

- [x] 3.1 Write unit tests for `requireAuth`: valid session → `next()` + `req.candidateId` set; missing/invalid/expired session → `401`, handler never called
- [x] 3.2 Implement `backend/api/middleware/requireAuth.ts`

## 4. Backend: Auth Routes (TDD)

- [x] 4.0a Add `maildev` service to `infra/docker-compose.yml`; write `backend/api/lib/emailService.ts` (nodemailer, SMTP env config) with a unit test (mock nodemailer's transport)
- [x] 4.1 Write unit tests (Jest + Supertest, following `backend/api/routes/uploads.test.ts`'s pattern) for `POST /auth/register`: successful registration (placeholder name, one reminder email sent), duplicate email rejected with `400`, password under 8 chars rejected
- [x] 4.2 Implement `POST /auth/register` in `backend/api/routes/auth.ts` (placeholder `firstName`/`lastName` per design.md Decision 5, sends the CV-upload reminder email)
- [x] 4.3 Write unit tests for `POST /auth/login`: success creates a session and sets the cookie; unknown email and wrong password both return the identical generic `401`
- [x] 4.4 Implement `POST /auth/login`
- [x] 4.5 Write unit tests for `GET /auth/session`: valid cookie → `200 { candidateId, email }`; missing/invalid cookie → `401`
- [x] 4.6 Implement `GET /auth/session`
- [x] 4.7 Write unit tests for `POST /auth/logout`: deletes the session; a subsequent `GET /auth/session` with the same cookie returns `401`
- [x] 4.8 Implement `POST /auth/logout`
- [x] 4.9 Wire the auth router into `backend/api/app.ts`

## 5. Backend: Login Rate Limiting (TDD)

- [x] 5.1 Write unit tests for the fixed-window Redis counter (design.md Decision 3): allows attempts under the threshold, rejects once exceeded, resets after the window
- [x] 5.2 Implement rate limiting on `POST /auth/login`

## 6. Backend: Protect CV Upload (TDD)

- [x] 6.1 Update `backend/api/routes/uploads.ts` to use `requireAuth` + `req.candidateId` instead of `req.body.candidateId`
- [x] 6.2 Update `backend/api/routes/uploads.test.ts` to authenticate via a mocked/stubbed session instead of passing `candidateId` in the body
- [x] 6.3 Write a new test: an unauthenticated `POST /uploads/cv` returns `401` and does not persist a `Resume` or enqueue a job

## 7. Backend: Logging Safety Check

- [x] 7.1 Verify request/error logging middleware does not dump raw `/auth/*` request bodies (grep existing logging middleware; add redaction if it does) — confirmed no request-logging middleware (e.g. morgan) exists in `backend/api`; the only `console.log`/`console.error` calls are the BullMQ job-failure logger (job id + error message) and this change's own email-failure logger, neither of which logs `req.body` or a password

## 8. Backend: Review and Update Existing Unit Tests (MANDATORY)

- [x] 8.1 Run the full backend Jest suite; identify any test beyond `uploads.test.ts` broken by the new auth requirement — none found, all 41 tests pass
- [x] 8.2 Fix any broken tests found — none needed

## 9. Backend: Run Unit Tests and Verify Database State (MANDATORY)

- [x] 9.1 Capture the pre-test `candidates` table baseline
- [x] 9.2 Run targeted unit tests for the `auth`/`session`/`requireAuth`/`uploads` modules
- [x] 9.3 Run the full backend Jest suite
- [x] 9.4 Verify post-test database state; restore if any test left residue
- [x] 9.5 Create report `specs/reports/YYYY-MM-DD-step-9-unit-test-and-db-verification.md`

## 10. Backend: Manual Endpoint Testing with curl (MANDATORY - AGENT MUST EXECUTE)

- [x] 10.1 Ensure the backend stack (`infra/docker-compose.yml`) is running
- [x] 10.2 `curl POST /auth/register` — success; verify the candidate row and that the stored password is a bcrypt hash, not plain text
- [x] 10.3 `curl POST /auth/register` — duplicate email rejected with `400`
- [x] 10.4 `curl POST /auth/login` — success; capture the `Set-Cookie` header
- [x] 10.5 `curl POST /auth/login` — wrong password and unknown email; verify both return the identical generic error
- [x] 10.6 `curl GET /auth/session` — with the cookie (`200`), and without it (`401`)
- [x] 10.7 `curl POST /uploads/cv` — with the session cookie (`202`, `candidateId` derived from session, real PDF from `parse-candidate-cv`'s fixtures) and without it (`401`)
- [x] 10.8 `curl POST /auth/logout` — then retry `GET /auth/session` with the same cookie, confirm `401`
- [x] 10.9 Restore database state: delete any candidate/resume rows created by this step's curl calls
- [x] 10.10 Document all commands and responses in report `specs/reports/YYYY-MM-DD-step-10-manual-curl-verification.md`

## 11. Frontend: Auth Pages (TDD)

- [x] 11.1 Write Vitest + RTL tests for `useAuth` (register/login/logout mutations)
- [x] 11.2 Implement `frontend/src/features/auth/useAuth.ts`
- [x] 11.3 Write tests for `RegisterPage`: submit calls the register mutation; duplicate-email error is shown
- [x] 11.4 Implement `frontend/src/features/auth/RegisterPage.tsx`
- [x] 11.5 Write tests for `LoginPage`: submit calls the login mutation; a generic error is shown on failure; success navigates to the workspace
- [x] 11.6 Implement `frontend/src/features/auth/LoginPage.tsx`, replacing `LoginPageStub` in `frontend/src/routes/router.tsx`
- [x] 11.7 Add a logout action wired to the logout mutation, clearing the session and redirecting to `/login`

## 12. Frontend: Flip the `useSession` Swap Point to Live

- [x] 12.1 Update `frontend/src/features/auth/useSession.ts` so the default (real app runtime) implementation is `live`, per design.md Decision 4
- [x] 12.2 Update `frontend/src/routes/router.tsx` to route to the real `LoginPage`/`RegisterPage`
- [x] 12.3 Update `frontend/src/App.test.tsx` (and any other test relying on the old default-mock behavior) so it isn't silently broken by the new live default — mock the `useSession` module or stub `VITE_AUTH_MODE=mock` explicitly for that test, per design.md's Risk mitigation

## 13. Frontend: Review and Update Existing Unit Tests (MANDATORY)

- [x] 13.1 Run the full frontend Vitest suite; fix anything broken by the router/auth-default changes
- [x] 13.2 Review tests against `specs/candidate-authentication/spec.md` and the `cv-upload` delta spec for coverage gaps; add or adjust tests for anything uncovered — found and fixed one real gap: `CvUploadForm`/`useCvUpload` still sent a client-supplied `candidateId`, which the backend now ignores entirely; removed it and the now-unneeded `useSession()` coupling

## 14. Frontend: Run Unit Tests and Build Verification (MANDATORY)

- [x] 14.1 Run the full Vitest suite
- [x] 14.2 Run `npm run build`; confirm zero TypeScript errors
- [x] 14.3 Create report `specs/reports/YYYY-MM-DD-step-14-unit-test-and-build-verification.md`

## 15. Full-Stack E2E Testing with Playwright (MANDATORY - AGENT MUST EXECUTE)

- [x] 15.1 Ensure the frontend dev server and the backend stack are both running
- [x] 15.2 Playwright E2E: register a new candidate → log in → reach the workspace → upload a real PDF (now correctly authenticated, no `candidateId` in the request body) → observe completion
- [x] 15.3 Playwright E2E: log out → confirm the workspace is no longer reachable and the visitor is redirected to `/login`
- [x] 15.4 Playwright E2E: a wrong password shows the generic error, not an enumeration-revealing detail
- [x] 15.5 Verify the resulting database state (candidate, resume, extraction persisted correctly); clean up any test data created
- [x] 15.6 Document results in report `specs/reports/YYYY-MM-DD-step-15-e2e-verification.md`

## 16. Bugs Found and Fixed During Real E2E Testing (discovered in Group 15)

- [x] 16.1 Fix `useSession.live.ts`: `isAuthenticated` was derived via a `useEffect`-driven `authStore` update one render behind the query result, so `ProtectedRoute` could observe `isLoading:false` with a stale `isAuthenticated:false` right after login and bounce a freshly-authenticated candidate back to `/login`. Derive session state directly from the query result instead.
- [x] 16.2 Add a regression unit test (`useSession.live.test.tsx`) asserting no render ever reports `isLoading:false` with `isAuthenticated:false` once a valid session resolves
- [x] 16.3 Fix `cvExtractionProcessor.ts`: stop overwriting `Candidate.email`/`firstName`/`lastName`/`phone`/`address` from CV content — `Candidate.email` is now a login credential and silently rewriting it (or crashing on a cross-candidate email collision, observed for real) is wrong now that login exists. Persist extracted personal info onto the `Resume` record instead (`extractedFirstName`/`extractedLastName`/`extractedEmail`/`extractedPhone`/`extractedAddress`, new nullable fields + migration)
- [x] 16.4 Update `cvExtractionProcessor.test.ts` for the `Resume`-scoped persistence
- [x] 16.5 Frontend: `UploadPage` shows a non-blocking notice when a completed extraction's `personal_info.email` differs from the candidate's account email, instead of silently applying or silently ignoring the difference
- [x] 16.6 Tests for the mismatch notice (shown when emails differ, absent when they match)
- [x] 16.7 Bump `frontend/playwright.config.ts`'s test timeout (30s default was shorter than the real CV-extraction flow's own 60s assertion timeout)
- [x] 16.8 Update `design.md` (Decision 6), `proposal.md` (Capabilities/Impact), and add a `cv-extraction` delta spec reflecting the corrected persistence behavior and the new mismatch-notice requirement
- [x] 16.9 Re-run the full Playwright E2E suite against the fixes; verify via direct DB query that `Candidate.email` stays as registered and extracted info lands on `Resume`

## 17. Documentation (MANDATORY)

- [x] 17.1 Update `docs/api-spec.yml`: add the `Auth` tag/paths; remove `candidateId` from `POST /uploads/cv`'s documented request body
- [x] 17.2 Confirm `docs/data-model.md` reflects `passwordHash` (on `Candidate`) and the new extracted-info fields (on `Resume`) consistently, and clarifies `Candidate.email` is login-only
- [x] 17.3 Update `frontend/README.md`: document `live` as the real-app default, keep the `?mockSession=unauthenticated` note only as it applies to the still-mock-based unit-test suite
- [x] 17.4 Confirm `docs/backend-standards.md` and `docs/frontend-standards.md` still accurately describe what was built, or note deviations — both remain accurate, no new deviations beyond what `candidate-workspace` already fixed

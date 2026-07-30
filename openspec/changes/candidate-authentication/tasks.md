## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [ ] 0.1 Create feature branch `feature/candidate-authentication` from main
- [ ] 0.2 Verify branch creation and current branch status

## 1. Data Model: `passwordHash`

- [ ] 1.1 Add `Candidate.passwordHash` to `backend/prisma/schema.prisma`
- [ ] 1.2 Generate and apply the Prisma migration
- [ ] 1.3 Update `docs/data-model.md` with the new field

## 2. Backend: Session Storage (TDD)

- [ ] 2.1 Write unit tests for `backend/api/lib/session.ts` (`createSession`, `getSession`, `deleteSession`): create-then-read round trip, TTL applied, delete makes a subsequent read miss
- [ ] 2.2 Implement `backend/api/lib/session.ts`, reusing the `REDIS_HOST`/`REDIS_PORT` connection pattern from `backend/api/queue/cvExtractionQueue.ts`

## 3. Backend: `requireAuth` Middleware (TDD)

- [ ] 3.1 Write unit tests for `requireAuth`: valid session → `next()` + `req.candidateId` set; missing/invalid/expired session → `401`, handler never called
- [ ] 3.2 Implement `backend/api/middleware/requireAuth.ts`

## 4. Backend: Auth Routes (TDD)

- [ ] 4.1 Write unit tests (Jest + Supertest, following `backend/api/routes/uploads.test.ts`'s pattern) for `POST /auth/register`: successful registration, duplicate email rejected with `400`, password under 8 chars rejected
- [ ] 4.2 Implement `POST /auth/register` in `backend/api/routes/auth.ts`
- [ ] 4.3 Write unit tests for `POST /auth/login`: success creates a session and sets the cookie; unknown email and wrong password both return the identical generic `401`
- [ ] 4.4 Implement `POST /auth/login`
- [ ] 4.5 Write unit tests for `GET /auth/session`: valid cookie → `200 { candidateId, email }`; missing/invalid cookie → `401`
- [ ] 4.6 Implement `GET /auth/session`
- [ ] 4.7 Write unit tests for `POST /auth/logout`: deletes the session; a subsequent `GET /auth/session` with the same cookie returns `401`
- [ ] 4.8 Implement `POST /auth/logout`
- [ ] 4.9 Wire the auth router into `backend/api/app.ts`

## 5. Backend: Login Rate Limiting (TDD)

- [ ] 5.1 Write unit tests for the fixed-window Redis counter (design.md Decision 3): allows attempts under the threshold, rejects once exceeded, resets after the window
- [ ] 5.2 Implement rate limiting on `POST /auth/login`

## 6. Backend: Protect CV Upload (TDD)

- [ ] 6.1 Update `backend/api/routes/uploads.ts` to use `requireAuth` + `req.candidateId` instead of `req.body.candidateId`
- [ ] 6.2 Update `backend/api/routes/uploads.test.ts` to authenticate via a mocked/stubbed session instead of passing `candidateId` in the body
- [ ] 6.3 Write a new test: an unauthenticated `POST /uploads/cv` returns `401` and does not persist a `Resume` or enqueue a job

## 7. Backend: Logging Safety Check

- [ ] 7.1 Verify request/error logging middleware does not dump raw `/auth/*` request bodies (grep existing logging middleware; add redaction if it does)

## 8. Backend: Review and Update Existing Unit Tests (MANDATORY)

- [ ] 8.1 Run the full backend Jest suite; identify any test beyond `uploads.test.ts` broken by the new auth requirement
- [ ] 8.2 Fix any broken tests found

## 9. Backend: Run Unit Tests and Verify Database State (MANDATORY)

- [ ] 9.1 Capture the pre-test `candidates` table baseline
- [ ] 9.2 Run targeted unit tests for the `auth`/`session`/`requireAuth`/`uploads` modules
- [ ] 9.3 Run the full backend Jest suite
- [ ] 9.4 Verify post-test database state; restore if any test left residue
- [ ] 9.5 Create report `specs/reports/YYYY-MM-DD-step-9-unit-test-and-db-verification.md`

## 10. Backend: Manual Endpoint Testing with curl (MANDATORY - AGENT MUST EXECUTE)

- [ ] 10.1 Ensure the backend stack (`infra/docker-compose.yml`) is running
- [ ] 10.2 `curl POST /auth/register` — success; verify the candidate row and that the stored password is a bcrypt hash, not plain text
- [ ] 10.3 `curl POST /auth/register` — duplicate email rejected with `400`
- [ ] 10.4 `curl POST /auth/login` — success; capture the `Set-Cookie` header
- [ ] 10.5 `curl POST /auth/login` — wrong password and unknown email; verify both return the identical generic error
- [ ] 10.6 `curl GET /auth/session` — with the cookie (`200`), and without it (`401`)
- [ ] 10.7 `curl POST /uploads/cv` — with the session cookie (`202`, `candidateId` derived from session, real PDF from `parse-candidate-cv`'s fixtures) and without it (`401`)
- [ ] 10.8 `curl POST /auth/logout` — then retry `GET /auth/session` with the same cookie, confirm `401`
- [ ] 10.9 Restore database state: delete any candidate/resume rows created by this step's curl calls
- [ ] 10.10 Document all commands and responses in report `specs/reports/YYYY-MM-DD-step-10-manual-curl-verification.md`

## 11. Frontend: Auth Pages (TDD)

- [ ] 11.1 Write Vitest + RTL tests for `useAuth` (register/login/logout mutations)
- [ ] 11.2 Implement `frontend/src/features/auth/useAuth.ts`
- [ ] 11.3 Write tests for `RegisterPage`: submit calls the register mutation; duplicate-email error is shown
- [ ] 11.4 Implement `frontend/src/features/auth/RegisterPage.tsx`
- [ ] 11.5 Write tests for `LoginPage`: submit calls the login mutation; a generic error is shown on failure; success navigates to the workspace
- [ ] 11.6 Implement `frontend/src/features/auth/LoginPage.tsx`, replacing `LoginPageStub` in `frontend/src/routes/router.tsx`
- [ ] 11.7 Add a logout action wired to the logout mutation, clearing the session and redirecting to `/login`

## 12. Frontend: Flip the `useSession` Swap Point to Live

- [ ] 12.1 Update `frontend/src/features/auth/useSession.ts` so the default (real app runtime) implementation is `live`, per design.md Decision 4
- [ ] 12.2 Update `frontend/src/routes/router.tsx` to route to the real `LoginPage`/`RegisterPage`
- [ ] 12.3 Update `frontend/src/App.test.tsx` (and any other test relying on the old default-mock behavior) so it isn't silently broken by the new live default — mock the `useSession` module or stub `VITE_AUTH_MODE=mock` explicitly for that test, per design.md's Risk mitigation

## 13. Frontend: Review and Update Existing Unit Tests (MANDATORY)

- [ ] 13.1 Run the full frontend Vitest suite; fix anything broken by the router/auth-default changes
- [ ] 13.2 Review tests against `specs/candidate-authentication/spec.md` and the `cv-upload` delta spec for coverage gaps; add or adjust tests for anything uncovered

## 14. Frontend: Run Unit Tests and Build Verification (MANDATORY)

- [ ] 14.1 Run the full Vitest suite
- [ ] 14.2 Run `npm run build`; confirm zero TypeScript errors
- [ ] 14.3 Create report `specs/reports/YYYY-MM-DD-step-14-unit-test-and-build-verification.md`

## 15. Full-Stack E2E Testing with Playwright (MANDATORY - AGENT MUST EXECUTE)

- [ ] 15.1 Ensure the frontend dev server and the backend stack are both running
- [ ] 15.2 Playwright E2E: register a new candidate → log in → reach the workspace → upload a real PDF (now correctly authenticated, no `candidateId` in the request body) → observe completion
- [ ] 15.3 Playwright E2E: log out → confirm the workspace is no longer reachable and the visitor is redirected to `/login`
- [ ] 15.4 Playwright E2E: a wrong password shows the generic error, not an enumeration-revealing detail
- [ ] 15.5 Verify the resulting database state (candidate, resume, extraction persisted correctly); clean up any test data created
- [ ] 15.6 Document results in report `specs/reports/YYYY-MM-DD-step-15-e2e-verification.md`

## 16. Documentation (MANDATORY)

- [ ] 16.1 Update `docs/api-spec.yml`: add the `Auth` tag/paths; remove `candidateId` from `POST /uploads/cv`'s documented request body
- [ ] 16.2 Confirm `docs/data-model.md` reflects `passwordHash` consistently (cross-check against task 1.3)
- [ ] 16.3 Update `frontend/README.md`: document `live` as the real-app default, keep the `?mockSession=unauthenticated` note only as it applies to the still-mock-based unit-test suite
- [ ] 16.4 Confirm `docs/backend-standards.md` and `docs/frontend-standards.md` still accurately describe what was built, or note deviations

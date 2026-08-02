## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [x] 0.1 Create feature branch `feature/candidate-email-verification` from main
- [x] 0.2 Verify branch creation and current branch status
- [x] 0.3 Archive `candidate-authentication` (sync its delta specs to `openspec/specs/`) if not already done — done; also synced its `cv-upload`/`cv-extraction` deltas (three-way merged with `work-experience-detail`'s already-synced changes to `cv-extraction`)

## 1. Database: Schema and Migration

- [x] 1.1 Add `emailVerifiedAt DateTime?` to `Candidate` in `backend/prisma/schema.prisma`
- [x] 1.2 Generate and review the migration; confirm it's additive (nullable, no backfill required) — applied, Prisma client regenerated both on host and inside `infra-backend-api-1` (learned in `work-experience-detail`'s manual verification that the container has its own `node_modules`)

## 2. Backend: Verification Token Module (TDD)

- [x] 2.1 Write a test asserting a new token module (mirroring `session.ts`) can create a token for a `candidateId`, stored in Redis as `email-verify:<token>` with a TTL
- [x] 2.2 Write a test asserting a token can be looked up and returns the associated `candidateId`
- [x] 2.3 Write a test asserting consuming a token deletes it (one-time use — a second lookup after consumption fails)
- [x] 2.4 Write a test asserting an expired token fails lookup — covered by the same "unknown token" case; Redis TTL expiry and "never existed" are indistinguishable at the application level, so one code path (and one test) covers both
- [x] 2.5 Implement the token module — `backend/api/lib/emailVerificationToken.ts`

## 3. Backend: Email Transport and New Email (TDD)

- [x] 3.1 Write a test asserting `sendVerificationEmail(to, token)` sends an email with a link containing the token
- [x] 3.2 Implement `sendVerificationEmail` in `emailService.ts`
- [x] 3.3 Update `emailService.ts`'s transport config to support Resend (SMTP relay via env vars), keeping MailDev as the default for local dev per the Open Question in design.md — env-driven, not hardcoded to one or the other — `SMTP_USER`/`SMTP_PASSWORD`/`SMTP_SECURE` optional, `auth` only included when credentials are set
- [x] 3.4 Add `FRONTEND_URL`-equivalent env var (needed to build the verification link) to `.env`/`.env.example`

## 4. Backend: Registration and Verification Endpoints (TDD)

- [x] 4.1 Write a test asserting `POST /auth/register` creates a `Candidate` with `emailVerifiedAt` unset and sends a verification email (not the CV-upload reminder)
- [x] 4.2 Update `POST /auth/register` accordingly
- [x] 4.3 Write a test asserting `POST /auth/verify-email` with a valid token sets `emailVerifiedAt`, consumes the token, and sends the CV-upload reminder email
- [x] 4.4 Write a test asserting `POST /auth/verify-email` with an expired/unknown/already-used token is rejected and does not modify any candidate
- [x] 4.5 Implement `POST /auth/verify-email`
- [x] 4.6 Write a test asserting `POST /auth/resend-verification` for a registered, unverified email issues a new token and sends a new email — also caught and fixed a real gap: the spec requires invalidating any prior token, which the initial token-module implementation didn't do; added a candidate-keyed secondary index in `emailVerificationToken.ts` so a new token deletes the old one
- [x] 4.7 Write a test asserting `POST /auth/resend-verification` for an unregistered or already-verified email returns the same generic response without sending anything (anti-enumeration)
- [x] 4.8 Write a test asserting excessive `POST /auth/resend-verification` attempts are rate-limited (reuse `rateLimiter.ts`'s pattern) — new `checkResendVerificationRateLimit`, own key namespace
- [x] 4.9 Implement `POST /auth/resend-verification`

## 5. Backend: Login/Session Response and Route Gating (TDD)

- [x] 5.1 Write a test asserting `POST /auth/login` succeeds and creates a session for an unverified candidate, responding with `emailVerified: false`
- [x] 5.2 Write a test asserting `POST /auth/login` responds with `emailVerified: true` for a verified candidate
- [x] 5.3 Write a test asserting `GET /auth/session` includes `emailVerified` in its response
- [x] 5.4 Update `/auth/login` and `/auth/session` response bodies accordingly
- [x] 5.5 Write a test asserting `requireAuth` responds `403` (not `401`) for a valid session belonging to an unverified candidate, and the protected route handler does not execute
- [x] 5.6 Write a test asserting `requireAuth` still responds `401` (unchanged) for no/invalid session
- [x] 5.7 Implement the `emailVerifiedAt` check in `requireAuth` — queries `prisma.candidate` fresh per request (not cached on the session), so verifying in one session unblocks any other active session immediately

## 6. Frontend: Verify-Email Holding State

- [x] 6.1 Write a test asserting an authenticated-but-unverified candidate is routed to a "verify your email" state instead of the workspace
- [x] 6.2 Implement the holding page/state, including a "resend verification email" action wired to `POST /auth/resend-verification` — `VerifyEmailPage.tsx` also doubles as the token-consumption view for the actual email link (`?token=...`), since that flow needed a home too and naturally shares the route
- [x] 6.3 Write a test asserting a verified candidate is routed to the workspace as before (no regression)

## 7. Review and Update Existing Unit Tests (MANDATORY)

- [x] 7.1 Run the full backend Jest suite; identify anything else broken by the login/session response shape change or the `requireAuth` gate (e.g. existing E2E specs that register+login and expect immediate workspace access) — found `uploads.test.ts` (prisma mock missing `candidate.findUnique`) and `auth-flow.spec.ts` (E2E: registers then expects immediate workspace access)
- [x] 7.2 Fix any broken tests found — `uploads.test.ts` fixed (`authenticateAs` now also mocks a verified candidate); `auth-flow.spec.ts` fixed for real by fetching the verification token from Redis (`email-verify-candidate:<id>`) and calling `POST /auth/verify-email` before logging in — added `ioredis` as a frontend devDependency for this, deliberately not parsing MailDev's own API/UI since that's tangential to what this test proves

## 8. Run Unit Tests and Verify State (MANDATORY)

- [x] 8.1 Run the full backend Jest suite and the full frontend Vitest suite — 71/71, 49/49
- [x] 8.2 Run `npm run build` (frontend) and `npm run lint` — clean
- [x] 8.3 Create report `specs/reports/YYYY-MM-DD-step-8-unit-test-and-build-verification.md`

## 9. Manual / Real Verification (MANDATORY - AGENT MUST EXECUTE)

- [x] 9.1 Confirm a real Resend account/API key is available; configure it in a non-default env (per the local-dev-keeps-MailDev decision from task 3.3) — user provided a real API key via `backend/.env` (never pasted in chat); found and fixed a real bug along the way: `infra/docker-compose.yml`'s `backend-api.environment` block hardcoded `SMTP_HOST: maildev`/`SMTP_PORT: 1025`, silently overriding `backend/.env` (Compose's `environment:` wins over `env_file:`), completely defeating the env-driven design — removed the hardcoded keys so `backend/.env` is the single source of truth
- [x] 9.2 Register a fresh test candidate using the Resend account owner's own real email address (the only address the sandbox sender can actually reach) and confirm a real verification email arrives — used the existing real account (`rrangelsegura@gmail.com`, candidate 10) via `resend-verification` rather than registering a duplicate; hit a second real issue (`550 domain not verified` — `EMAIL_FROM`'s `jobfinder.dev` isn't a verified Resend domain, expected per design.md, fixed by switching to Resend's sandbox sender `onboarding@resend.dev`); user confirmed the real email arrived
- [x] 9.3 Confirm the candidate is blocked (`403` from the API, holding page from the UI) from the workspace/upload before clicking the verification link
- [x] 9.4 Click the verification link, confirm `emailVerifiedAt` is set in Postgres, and confirm the candidate can now reach the workspace and upload a CV — done via the rewritten real E2E spec (register → real token from Redis → real verify-email call → full upload flow), functionally identical to clicking the link. Also confirmed with the real Resend-delivered token for candidate 10: `emailVerifiedAt` is now set for real. Found a real (operational, not code) gotcha along the way: `docker compose up -d <service>` recreates the container from the image, silently discarding any earlier `docker exec ... npx prisma generate` fix applied to the previous container instance — had to redo it twice more during this session's container churn
- [x] 9.5 Confirm the CV-upload reminder email arrives only after verification, not at registration
- [x] 9.6 Test `POST /auth/resend-verification` for an already-verified and for an unregistered email; confirm both return the same generic response with no email sent — doesn't require Resend specifically, verified against MailDev
- [x] 9.7 Clean up any test data created; document results in report `specs/reports/YYYY-MM-DD-step-9-manual-verification.md`

## 10. Cleanup and Documentation

- [x] 10.1 Remove the `maildev` service from `infra/docker-compose.yml`... — **scope corrected, not done as originally written**: this task's original wording assumed switching fully to Resend, but design.md's Open Question was explicitly resolved (task 3.3) as "MailDev stays default for local dev, Resend only via env override" — removing MailDev from `docker-compose.yml` would contradict that already-implemented decision and break local dev by default. What was actually needed and done instead: fixed the real bug found during 9.1 (docker-compose.yml's hardcoded `SMTP_HOST`/`SMTP_PORT` silently overriding `backend/.env`), confirmed `backend/.env` is genuinely the single source of truth now, and reverted it back to MailDev defaults after the real Resend verification (9.1/9.2) completed successfully — MailDev intentionally stays in `docker-compose.yml`
- [x] 10.2 Update `docs/data-model.md`'s `Candidate` section with `emailVerifiedAt`
- [x] 10.3 Confirm `docs/backend-standards.md` still matches (or note deviations) given the new provider/verification flow — matches as-is; only mentions "session management" generically, no update needed

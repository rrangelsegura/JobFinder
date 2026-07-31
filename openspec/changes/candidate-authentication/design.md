## Context

`candidate-workspace` (US-002, archived) shipped a full frontend behind a **mock** auth adapter (`useSession.mock.ts`) specifically because no real identity system existed. It also flagged a real security gap: `POST /uploads/cv` trusts a client-supplied `candidateId`. `US-003` (enriched) already resolved this change's three open design questions — credentials live on `Candidate` directly, sessions are Redis-backed (not JWT), passwords use bcrypt cost 12 — so this design's job is to turn those decisions into concrete implementation choices, not re-litigate them.

Redis is already running (`infra/docker-compose.yml`) for BullMQ (`backend/api/queue/cvExtractionQueue.ts`), so session storage adds no new infrastructure.

## Goals / Non-Goals

**Goals:**
- Real registration, login, logout, and session-check per `US-003`'s documented endpoints.
- Close the `candidateId` client-trust gap in `POST /uploads/cv` by deriving it from the session via a reusable `requireAuth` middleware.
- Flip `candidate-workspace`'s `useSession()` swap point from mock to live with a one-line change, and build the missing `LoginPage`/`RegisterPage` it was designed to redirect to.

**Non-Goals:**
- Password reset, social/OAuth login, MFA, email verification, account deletion, or role-based permissions — all explicitly out of scope per `US-003`.
- `Employee` (company-side) authentication — a separate concern if/when that side of the product is built.
- Redesigning `candidate-workspace`'s UI shell — this change only adds the two new pages (`LoginPage`, `RegisterPage`) and swaps the auth adapter's implementation.

## Decisions

### 1. `requireAuth` as Express middleware, not per-route logic

`backend/api/middleware/requireAuth.ts` reads the session cookie, looks up the session in Redis, and either attaches `req.candidateId` (extending Express's `Request` type) and calls `next()`, or responds `401` directly — the route handler never runs. `backend/api/routes/uploads.ts`'s `POST /uploads/cv` is updated to use `req.candidateId` instead of `req.body.candidateId`; the existing Multer file-processing logic is unchanged, only the identity source moves.

**Alternative considered**: inline the session check in each route that needs it. Rejected — `requireAuth` is designed to protect any future route (chat, action plan, analysis results) the same way, and `candidate-workspace`'s own `ProtectedRoute` (frontend) already established the "one shared gate" pattern; the backend should mirror it.

### 2. Session storage: `backend/api/lib/session.ts`, same connection pattern as BullMQ

A thin `ioredis` wrapper (`createSession`, `getSession`, `deleteSession`) using the same `REDIS_HOST`/`REDIS_PORT` env-driven connection config already established in `cvExtractionQueue.ts` — no new Redis client configuration surface. Key shape: `session:<sessionId>` → `{ candidateId }` (JSON), with a 7-day TTL (`EX` on write). The cookie carries only an opaque session id, never the candidate id itself.

### 3. Rate limiting: fixed-window counter in Redis, not a new dependency

`POST /auth/login` increments a Redis key (`login-attempts:<ip>`, or `:<email>` — both, since either alone is bypassable) with a TTL window (e.g., 60s), rejecting once a threshold is exceeded. Reuses the same Redis instance already in play for sessions and BullMQ — no new package (e.g., `express-rate-limit` + a Redis store) is needed for this scope. Threshold and window are implementation constants for now, not user-configurable.

### 4. Frontend: swap the adapter, don't rewrite the boundary

`candidate-workspace`'s `useSession.live.ts` (design.md Decision 1 of that change) already calls `GET /auth/session` and populates `authStore` correctly per this story's actual response shape (`{ candidateId, email }` / `401`) — it was written against this exact contract and needs no changes. The only change to `frontend/src/features/auth/useSession.ts` is which implementation it re-exports (mock → live). `LoginPage`/`RegisterPage` are new, built with the same TanStack Query + Shadcn/UI + Vitest/RTL conventions already established in that change.

### 5. Registration collects only email + password; a placeholder name is written until the candidate's identity is known

`Candidate.firstName`/`lastName` are `NOT NULL` with no default, but `US-003`'s `POST /auth/register` contract is `{ email, password }` only — no name fields. Rather than extending the register contract or making the columns nullable (both real options, decided against below), registration writes placeholder values (`firstName: "New"`, `lastName: "Candidate"`).

**Note**: this decision originally assumed the CV-extraction pipeline would overwrite these placeholders on upload — Decision 6 below revisits and corrects that assumption. The placeholder itself, and the reasoning against extending the register form or making the columns nullable, still stand.

To close the gap between "registered" and "uploaded a CV," `POST /auth/register` sends a single, one-shot reminder email ("upload your CV") immediately on successful registration — no retry, no scheduling, no delivery-state tracking. This needs a minimal `backend/api/lib/emailService.ts` (nodemailer, SMTP config via env vars) since no email infrastructure exists in this project yet. For real (non-mocked) verification without depending on an external provider or a real inbox, `infra/docker-compose.yml` gains a `maildev` service (SMTP catcher + web UI) — the same "verify for real" discipline `parse-candidate-cv` and `candidate-workspace` already established, applied to email the same way it was applied to OCR/LLM calls and CORS.

**Alternatives considered**:
- Extend `POST /auth/register` to accept `firstName`/`lastName`. Rejected for this change — `US-003`'s documented contract doesn't ask for them.
- Nullable `firstName`/`lastName`. Rejected — contradicts `docs/data-model.md`'s existing validation rule ("required, 2-100 characters, letters only") and every other model/query in the codebase already assumes non-null names.
- Recurring/scheduled reminders "until they upload." Explicitly out of scope for this change — no job scheduler exists in this stack for arbitrary recurring per-candidate reminders (BullMQ here is used for one-shot extraction jobs, not cron-style recurrence), and building one is disproportionate to an auth story. A single reminder at registration is what ships now; recurring reminders are a candidate for a future, separate change if the single email proves insufficient.

### 6. CV-extracted personal info is per-resume, never overwrites `Candidate`'s login identity

Real E2E testing (Group 15) surfaced a genuine bug: `cvExtractionProcessor.ts` (from `parse-candidate-cv`, predating any login concept) wrote `personal_info.{first_name,last_name,email,phone,address}` directly onto `Candidate`, including `email` — the login credential. Two real consequences followed immediately: (1) a candidate's login email could be silently rewritten by whatever email happens to appear in a CV they upload, and (2) re-using a CV whose email already belongs to another `Candidate` row hard-crashes the job on `email`'s unique constraint (observed for real during E2E testing).

The correct model, especially given candidates are expected to hold **multiple resumes** in the future (e.g. tailored per job application), is that CV-reported personal info is a property of *that resume*, not of the candidate's identity:

- `Resume` gains `extractedFirstName`/`extractedLastName`/`extractedEmail`/`extractedPhone`/`extractedAddress` (all nullable). `cvExtractionProcessor.ts` writes personal info there via `prisma.resume.update`, never `prisma.candidate.update`.
- `Candidate.{firstName,lastName,email,phone,address}` are no longer touched by extraction at all. `email` stays exactly what was registered; `firstName`/`lastName` stay at their registration placeholder until a future "edit profile" capability exists (out of scope here, same as it was before this correction).
- If a completed extraction's `personal_info.email` differs from the candidate's actual account email, the frontend (`UploadPage`) shows a non-blocking, informational notice — the candidate may have intentionally used a different contact email in their CV, or it could be a typo; either way it's surfaced, never silently applied.

This also modifies `cv-extraction`'s "Persistence and Embedding of Extraction Results" requirement (see the new delta spec) — its original text said extraction persists "the structured `Candidate`... data," which is no longer accurate for personal info specifically.

**Alternatives considered**:
- Keep overwriting `Candidate` but catch the unique-constraint collision and fail the job with a clear message. Rejected — doesn't address the more fundamental problem of silently changing a candidate's login email on every successful upload, which is surprising and risky even without a collision.
- Redesign `Education`/`WorkExperience`/`Skill`/`Language`/`Certification` to be resume-scoped too (they currently only have `candidateId`, so multiple resumes' entries would keep accumulating under one candidate with no way to tell which resume contributed what). Out of scope for this change — a real, separate gap worth addressing when multi-resume support is actually built, not something to redesign as a side effect of an auth story.

## Risks / Trade-offs

- **[Risk]** Existing `Candidate` rows created before this change (including any inserted directly for `candidate-workspace`'s manual E2E testing) have no `passwordHash` and can never log in normally. → **[Mitigation]** Not a blocker: this is pre-launch, test-only data. No migration/backfill is needed; those rows are disposable. Document this in the report rather than building migration tooling for data that doesn't need to survive.
- **[Risk]** `candidate-workspace`'s frontend E2E tests (Playwright) currently rely on the mock adapter's auto-login and `?mockSession=unauthenticated` escape hatch. Flipping the default adapter to live would break them against a backend that now requires a real session. → **[Mitigation]** Keep `VITE_AUTH_MODE` unset (mock) as the default for that project's existing test suite; this change's own E2E coverage (new, real login → protected route → logout) is what exercises `live` mode for real, via `VITE_AUTH_MODE=live` explicitly set for those runs.
- **[Risk]** Fixed-window rate limiting is simple but has known edge effects (burst at window boundary). → **[Mitigation]** Acceptable for this scope per `US-003`'s NFR ("even a simple fixed-window counter"); revisit only if abuse is observed in practice.
- **[Risk]** `Education`/`WorkExperience`/`Skill`/`Language`/`Certification` are still `candidateId`-scoped only, with no `resumeId` link. Re-uploading a second (or multiple) resume just accumulates more of these records under the same candidate with no way to tell which resume a given entry came from, and no de-duplication. → **[Mitigation]** Not fixed here — genuinely out of scope for an auth story. Flagged explicitly (per Decision 6) as a known gap for whenever multi-resume support becomes real product scope, not silently left undiscovered.

## Migration Plan

1. Add `Candidate.passwordHash` via Prisma migration (`backend/prisma/schema.prisma` + migration file). No backfill — pre-existing rows remain password-less and simply cannot log in (acceptable per the Risk above).
2. Deploy `backend/api/lib/session.ts`, `requireAuth`, and `auth.ts` routes together with the `uploads.ts` change in the same release — `uploads.ts` cannot be updated to require `requireAuth` before the auth routes exist, and shipping them separately would leave a window where uploads are broken for everyone.
3. Frontend `useSession.ts` swap to `live` ships in the same change, since `candidate-workspace`'s mock is documented as a stand-in specifically until this change lands.

**Rollback**: revert the `uploads.ts` change (restore `req.body.candidateId`) and the frontend adapter swap independently if `auth.ts` needs to be pulled post-deploy; the Prisma migration (additive column, nullable-safe) does not need reverting.

## Open Questions

None — `US-003`'s enrichment already resolved every open design question this change depended on.

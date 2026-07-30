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

## Risks / Trade-offs

- **[Risk]** Existing `Candidate` rows created before this change (including any inserted directly for `candidate-workspace`'s manual E2E testing) have no `passwordHash` and can never log in normally. → **[Mitigation]** Not a blocker: this is pre-launch, test-only data. No migration/backfill is needed; those rows are disposable. Document this in the report rather than building migration tooling for data that doesn't need to survive.
- **[Risk]** `candidate-workspace`'s frontend E2E tests (Playwright) currently rely on the mock adapter's auto-login and `?mockSession=unauthenticated` escape hatch. Flipping the default adapter to live would break them against a backend that now requires a real session. → **[Mitigation]** Keep `VITE_AUTH_MODE` unset (mock) as the default for that project's existing test suite; this change's own E2E coverage (new, real login → protected route → logout) is what exercises `live` mode for real, via `VITE_AUTH_MODE=live` explicitly set for those runs.
- **[Risk]** Fixed-window rate limiting is simple but has known edge effects (burst at window boundary). → **[Mitigation]** Acceptable for this scope per `US-003`'s NFR ("even a simple fixed-window counter"); revisit only if abuse is observed in practice.

## Migration Plan

1. Add `Candidate.passwordHash` via Prisma migration (`backend/prisma/schema.prisma` + migration file). No backfill — pre-existing rows remain password-less and simply cannot log in (acceptable per the Risk above).
2. Deploy `backend/api/lib/session.ts`, `requireAuth`, and `auth.ts` routes together with the `uploads.ts` change in the same release — `uploads.ts` cannot be updated to require `requireAuth` before the auth routes exist, and shipping them separately would leave a window where uploads are broken for everyone.
3. Frontend `useSession.ts` swap to `live` ships in the same change, since `candidate-workspace`'s mock is documented as a stand-in specifically until this change lands.

**Rollback**: revert the `uploads.ts` change (restore `req.body.candidateId`) and the frontend adapter swap independently if `auth.ts` needs to be pulled post-deploy; the Prisma migration (additive column, nullable-safe) does not need reverting.

## Open Questions

None — `US-003`'s enrichment already resolved every open design question this change depended on.

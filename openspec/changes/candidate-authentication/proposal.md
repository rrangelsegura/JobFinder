## Why

`candidate-workspace` (US-002) shipped a working dashboard and CV upload flow behind a mock auth adapter, explicitly because no real identity system exists yet. Two concrete problems block real use: (1) `POST /uploads/cv` trusts a client-supplied `candidateId` with no verification — anyone can attribute an upload to any candidate id — and (2) there is no way for a real job seeker to register, log in, or have their session persist, so the workspace can never be used with real user accounts.

## What Changes

- Add `Candidate.passwordHash` and implement `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/session` per `US-003`'s documented contract.
- Server-side sessions backed by Redis, delivered via an `httpOnly`/`secure`/`sameSite=lax` cookie — never a JWT, so logout revokes access immediately.
- Passwords hashed with bcrypt (cost factor 12); login failures return one generic error regardless of cause (anti-enumeration); basic per-IP/per-email rate limiting on login.
- New `requireAuth` Express middleware deriving `req.candidateId` from the session, reusable by any protected route.
- **BREAKING**: `POST /uploads/cv` no longer accepts `candidateId` in the request body — it now requires `requireAuth` and derives the candidate from the session. This closes the client-trust gap flagged during `candidate-workspace`'s enrichment.
- Frontend: `LoginPage`, `RegisterPage`, `useAuth` (register/login/logout mutations), and swapping `candidate-workspace`'s `useSession()` boundary from its mock to `useSession.live.ts` (already written, per that change's design.md Decision 1).

## Capabilities

### New Capabilities
- `candidate-authentication`: registration, login, logout, and session-check for candidates, backed by bcrypt password hashing and Redis-backed server-side sessions delivered via an httpOnly cookie.

### Modified Capabilities
- `cv-upload`: `candidateId` SHALL be derived from the authenticated session (via `requireAuth`), not accepted from the request body. Requests without a valid session are rejected before any upload processing occurs.

## Impact

- **Data model**: `Candidate.passwordHash` (new field, migration).
- **Backend API**: new `backend/api/routes/auth.ts`, `backend/api/middleware/requireAuth.ts`, `backend/api/lib/session.ts`; `backend/api/routes/uploads.ts` modified to use `requireAuth` instead of a body field; existing upload tests updated to reflect the new auth requirement.
- **Frontend**: new `frontend/src/features/auth/{LoginPage,RegisterPage}.tsx`, `useAuth.ts`; `frontend/src/features/auth/useSession.ts` swap point flipped from mock to live; `frontend/src/stores/authStore.ts` now populated from a real endpoint instead of a fixture.
- **Docs**: `docs/api-spec.yml` (new `Auth` tag, `candidateId` removed from `POST /uploads/cv`'s request body), `docs/data-model.md` (`passwordHash` field).
- **Infra**: none — Redis is already running (`infra/docker-compose.yml`, used today for BullMQ).

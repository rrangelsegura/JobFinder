## Why

JobFinder's CV parsing backend (`cv-upload`, `cv-extraction-status`, `cv-extraction` capabilities, shipped in `parse-candidate-cv`) is only reachable via direct API calls (curl) — there is no frontend at all yet in this repo. A real candidate has no way to use the platform. This change builds the first user-facing surface: a persistent workspace where a candidate can upload their CV and see it get processed, plus the navigational shell that every subsequent candidate-facing feature (chat, analysis results, action plan) will plug into without re-architecting.

## What Changes

- New frontend application (`frontend/`) scaffolded per `docs/frontend-standards.md`'s stack (React 18, TypeScript, Vite, React Router DOM, Tailwind, Shadcn/UI, Zustand, TanStack Query, Axios) — nothing exists under `frontend/` today.
- A persistent workspace shell with navigation: Upload (functional), Chat / Analysis Results / Action Plan (visible, explicitly disabled placeholders — not built yet).
- A CV upload flow wrapping the existing async `cv-upload` / `cv-extraction-status` backend contract: file selection, submit, live polling of job status, and distinct UI states for processing / completed / failed.
- Route protection gating the workspace behind an authenticated session.

## Capabilities

### New Capabilities
- `candidate-workspace-shell`: the persistent dashboard layout, navigation (including the disabled placeholder sections), and auth-gated routing that every workspace section lives inside.
- `cv-upload-ui`: the frontend flow that lets an authenticated candidate submit a CV and observe its async processing state through to completion or failure.

### Modified Capabilities
_None._ This change is frontend-only and does not modify `cv-upload`, `cv-extraction-status`, or `cv-extraction`'s existing requirements — the frontend consumes those contracts exactly as documented in `openspec/specs/`.

## Impact

- **New code**: `frontend/` (entire new application — see design.md for structure).
- **Consumes existing backend, unmodified**: `POST /uploads/cv`, `GET /uploads/cv/{jobId}` per `openspec/specs/cv-upload/spec.md` and `openspec/specs/cv-extraction-status/spec.md`.
- **Hard external dependency, not delivered by this change**: candidate authentication. There is no login/session mechanism anywhere in JobFinder yet. This change's route-protection and "who is the current candidate" logic are built against the session contract documented in the enriched `US-003 - Candidate Authentication` request (`ai-specs/requests/US-003.md`: `GET/POST /auth/*`, `httpOnly` session cookie) — but that capability has not been proposed or implemented as an OpenSpec change. See design.md for how this change stays buildable and testable despite that gap, and what remains genuinely blocked until `US-003` ships as a real change.
- **Known pre-existing security gap this change does NOT fix**: `POST /uploads/cv` currently trusts a client-supplied `candidateId` with no server-side verification. That fix requires the auth session to exist server-side first (`req.candidateId` derived from a verified session, per `US-003`'s enrichment) — it is out of scope for this change and must not be mistaken as resolved by adding a frontend.
- **Out of scope**: the Chat, Analysis Results, and Action Plan features themselves (nav placeholders only); any backend changes; authentication itself.

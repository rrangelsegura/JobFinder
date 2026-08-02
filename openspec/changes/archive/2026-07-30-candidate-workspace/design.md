## Context

`frontend/` does not exist in this repository. The backend contract this change consumes (`POST /uploads/cv`, `GET /uploads/cv/{jobId}`) is already built, tested, and archived (`parse-candidate-cv`) — this change does not touch it. `docs/frontend-standards.md` already commits this project to a specific stack (React 18, TypeScript, Vite, React Router DOM, Tailwind, Shadcn/UI, Zustand, TanStack Query, Axios), so the technology choice itself isn't a decision this design needs to make — it's a given constraint.

The real complication: this change's route protection and "who is the current candidate" logic depend on a session contract (`GET/POST /auth/*`, `httpOnly` cookie) that only exists on paper — `ai-specs/requests/US-003.md` (enriched) documents it, but no `US-003` OpenSpec change has been proposed or implemented. This design has to decide how to stay buildable and honestly testable despite that.

## Goals / Non-Goals

**Goals:**
- Ship a working workspace shell and CV upload flow that a real candidate could use once `US-003` exists, without the two changes being tangled together.
- Keep the auth integration point isolated enough that swapping the mock for `US-003`'s real endpoints is a contained change, not a rewrite.
- Be explicit, in tasks.md, about which verification steps are genuinely blocked on `US-003` — never mark a task done using a fake stand-in for a real dependency (same discipline `parse-candidate-cv` applied to infrastructure gaps).

**Non-Goals:**
- Implementing `US-003` itself (separate change).
- Implementing Chat, Analysis Results, or Action Plan (nav placeholders only).
- Fixing the `candidateId` client-trust security gap in `backend/api/routes/uploads.ts` — that fix requires `US-003`'s session to exist server-side and is that change's responsibility.

## Decisions

### 1. Auth adapter boundary: one hook, two implementations

All workspace code depends on a single hook, `useSession()`, returning `{ candidateId, email, isAuthenticated, isLoading }` — never on `fetch('/auth/session')` directly. Two implementations exist behind this same interface:
- `useSession.mock.ts` — used in local dev and in this change's automated tests, backed by a fixture matching `US-003`'s documented `GET /auth/session` response shape exactly (`{ candidateId, email }` / `401`).
- `useSession.live.ts` — the real implementation, calling `GET /auth/session` against the Node API Gateway. Written in this change (it's a thin TanStack Query wrapper, no reason to defer the code itself), but only genuinely exercisable end-to-end once `US-003` ships real `/auth/*` endpoints.

Which implementation is active is a single wiring point (one provider/import), not scattered conditionals — swapping to the real one when `US-003` lands should touch one file.

**Alternative considered**: build the workspace without any auth gate for now, add it when `US-003` ships. Rejected — `specs/candidate-workspace-shell/spec.md`'s "Authenticated Access Only" requirement would then be unimplemented, and retrofitting a route guard after the fact around already-built pages is more error-prone than building the boundary in from the start, even with a mock behind it.

### 2. Job status polling: TanStack Query with a status-conditional `refetchInterval`

`useCvExtractionStatus(jobId)` polls `GET /uploads/cv/{jobId}` via TanStack Query's `refetchInterval` option, computed from the last response: `2500ms` while `data.status === 'processing'`, `false` (stop) once `completed` or `failed`. No manual `setInterval`/`clearInterval` bookkeeping — this is exactly the built-in mechanism TanStack Query provides for this pattern, and it composes correctly with component unmount (query is automatically cancelled).

### 3. Failure messages: a small, explicit mapping table, not raw passthrough

`specs/cv-upload-ui/spec.md` requires a non-technical message, distinct from `data.error`. A lookup table matches known substrings from the backend's actual error strings (per `openspec/specs/cv-upload/spec.md` and `openspec/specs/cv-extraction/spec.md`) to friendly copy:

| Backend error contains | User-facing message |
|---|---|
| `"Unsupported file type"` | "Please upload a PDF file." |
| `"exceeds the maximum allowed size"` | "That file is too large (10MB max)." |
| `"unreadable or corrupted"` | "We couldn't read that file — try re-exporting your CV as a PDF." |
| `"OCR failed"` | "We had trouble reading your CV. Please try again or use a different file." |
| `"schema validation"` (LLM extraction failure) | "We had trouble understanding your CV's content. Please try again." |
| *(no match — unrecognized error)* | "Something went wrong processing your CV. Please try again." |

Copy lives in one module (`frontend/src/features/upload/errorMessages.ts`), not inlined at the call site — deliberate, since the actual target language for user-facing copy is an open question (see below) and centralizing it makes that a find-and-replace later, not a re-architecture.

## Risks / Trade-offs

- **[Risk]** The mock `useSession` could drift from what `US-003` actually ships (field names, error shapes) if that change's implementation differs from its current enrichment doc → **[Mitigation]** the mock fixture is written directly from `US-003`'s documented contract and should be updated the moment that change's real proposal/specs are written, not left to silently diverge.
- **[Risk]** Nothing in this change proves the real authenticated flow works end-to-end (mandatory per this project's manual-testing standard) → **[Mitigation]** tasks.md marks this explicitly as blocked-pending-`US-003`, not silently skipped or faked with the mock.
- **[Risk]** Disabled nav items for Chat/Analysis Results/Action Plan could look like a bug if not visually distinct → **[Mitigation]** use Shadcn's disabled/badge patterns consistently (e.g., a muted item + "Coming soon" badge), covered by a component test asserting the disabled state renders distinctly from the active Upload item.

## Open Questions

- **User-facing copy language** (English vs. Spanish vs. full i18n) is undecided anywhere in this project's docs. This design defaults to writing English copy for now, centralized in one module per Decision 3 specifically so the eventual answer doesn't require touching component logic — but the actual product decision is still open and should be made explicitly, not by default, before this ships to real users.

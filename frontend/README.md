# JobFinder Frontend

Candidate-facing dashboard for JobFinder (`candidate-workspace` OpenSpec change). React 18 + TypeScript + Vite, per `docs/frontend-standards.md`.

## Stack

React Router DOM, Tailwind CSS v4 + Shadcn/UI, Zustand, TanStack Query, Axios, Vitest + React Testing Library, Playwright.

## Setup

```bash
npm install
```

## Run

```bash
npm run dev       # dev server, http://localhost:5173
npm run build     # tsc -b && vite build
npm run preview   # preview the production build
```

The API base URL defaults to `http://localhost:3000` (the Node API Gateway from `infra/docker-compose.yml`). Override with `VITE_API_BASE_URL` if needed.

## Auth adapter

All workspace code depends on `useSession()` (`src/features/auth/useSession.ts`), never on the auth API directly. Two implementations exist behind that interface (see `openspec/changes/candidate-workspace/design.md` Decision 1):

- **mock** (default) — auto-authenticates as a fixture candidate. Used for local dev and this change's automated tests, since `US-003` (Candidate Authentication) hasn't shipped yet.
- **live** — real `GET /auth/session` call. Enable with `VITE_AUTH_MODE=live`; only genuinely exercisable once `US-003` ships.

For E2E tests that need to exercise the unauthenticated path against the mock, append `?mockSession=unauthenticated` to the URL.

## Tests

```bash
npm run test          # Vitest (unit/component)
npm run test:watch    # Vitest, watch mode
npm run test:e2e      # Playwright — requires the dev server AND infra/docker-compose.yml backend stack running
npm run lint           # ESLint
npm run format          # Prettier --write
npm run format:check    # Prettier --check
```

`npm run test:e2e` needs a real backend: from `infra/`, `docker compose up -d`, and a `Candidate` row whose `id` matches `useSession.mock.ts`'s `MOCK_SESSION_FIXTURE.candidateId` (currently `1`) — registration doesn't exist yet (`US-003`), so this candidate must be inserted directly for now.

## Deviations from `docs/frontend-standards.md`

Fixed two stale claims in the standards doc itself while building this change: it referenced a `tailwind.config.js` that doesn't exist under Tailwind CSS v4 (config lives in `vite.config.ts` + `@theme` in `index.css` instead), and a `codex/feature-frontend-name` branch convention that doesn't match this project's actual `feature/<change-name>` practice.

Not yet used, but still the standard for future work in this codebase: Zod response validation, Recharts, Framer Motion, and strict Atomic Design folder structure — none were needed for the workspace shell / CV upload scope of this change (no charts, no agent-reasoning animations, and a flat `features/<domain>` layout was sufficient at this size).

## Known limitations

- Chat, Analysis Results, and Action Plan are disabled navigation placeholders — not implemented (see `openspec/changes/candidate-workspace/design.md` Non-Goals).
- `POST /uploads/cv` still takes `candidateId` in the request body (a pre-existing client-trust gap); deriving it server-side from the session is `US-003`'s responsibility.
- Full authenticated E2E (real login → real session cookie → protected route) is blocked until `US-003` ships; see `openspec/changes/candidate-workspace/specs/reports/2026-07-30-step-7-manual-e2e-verification.md`.

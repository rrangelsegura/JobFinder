# JobFinder Frontend

Candidate-facing dashboard for JobFinder (`candidate-workspace` + `candidate-authentication` OpenSpec changes). React 18 + TypeScript + Vite, per `docs/frontend-standards.md`.

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

- **live** (default) — real `GET /auth/session` call against the Node API Gateway's `/auth/*` endpoints (`candidate-authentication`).
- **mock** — auto-authenticates as a fixture candidate. Set `VITE_AUTH_MODE=mock` for local UI work with no backend running, or for tests that stub the session directly.

For E2E tests that need to exercise the unauthenticated path against the mock adapter specifically, append `?mockSession=unauthenticated` to the URL — not needed against the (now default) live adapter, since a fresh browser context with no session cookie naturally hits the real `401` → redirect path.

## Tests

```bash
npm run test          # Vitest (unit/component)
npm run test:watch    # Vitest, watch mode
npm run test:e2e      # Playwright — requires the dev server AND infra/docker-compose.yml backend stack running
npm run lint           # ESLint
npm run format          # Prettier --write
npm run format:check    # Prettier --check
```

`npm run test:e2e` needs the real backend stack running (`docker compose up -d` from `infra/`) — registration and login are real now (`candidate-authentication`), so E2E specs register their own throwaway candidate rather than depending on a pre-seeded fixture row.

## Deviations from `docs/frontend-standards.md`

Fixed two stale claims in the standards doc itself while building `candidate-workspace`: it referenced a `tailwind.config.js` that doesn't exist under Tailwind CSS v4 (config lives in `vite.config.ts` + `@theme` in `index.css` instead), and a `codex/feature-frontend-name` branch convention that doesn't match this project's actual `feature/<change-name>` practice.

Not yet used, but still the standard for future work in this codebase: Zod response validation, Recharts, Framer Motion, and strict Atomic Design folder structure — none were needed for the workspace shell / CV upload / auth scope built so far (no charts, no agent-reasoning animations, and a flat `features/<domain>` layout was sufficient at this size).

## Known limitations

- Chat, Analysis Results, and Action Plan are disabled navigation placeholders — not implemented (see `openspec/changes/candidate-workspace/design.md` Non-Goals).
- No password reset, social/OAuth login, MFA, email verification, or profile-editing UI (all explicitly out of scope per `US-003`) — a candidate's `firstName`/`lastName` stay at registration placeholders until a future "edit profile" capability exists.
- `Education`/`WorkExperience`/`Skill`/`Language`/`Certification` are candidate-scoped, not resume-scoped — a known gap for whenever multi-resume support becomes real product scope (see `openspec/changes/candidate-authentication/design.md` Decision 6 / Risks).

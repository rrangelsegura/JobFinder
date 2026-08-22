## Why

JobFinder has 32 test files (Jest, Pytest, Vitest, Playwright) and zero automated execution of them: there is no `.github/workflows/` and no CI system of any kind. Every merge to `main` today is verified manually via per-change "Step N" reports inside `openspec/changes/archive/*/specs/reports/`. `docs/development_guide.md` explicitly defers this ("Deployment details will be added once the CI/CD pipeline is defined") — this change defines and builds it for the first time, starting with the fully-mocked unit-test suite that already exists and needs no live services to run.

## What Changes

- Add a GitHub Actions workflow (`.github/workflows/ci.yml`) triggered on pull requests targeting `main` and on pushes to `main`.
- Workflow runs on a **self-hosted runner** (not GitHub-hosted), registered against this repository, with Node 20, Python 3.11, `tesseract-ocr`, `poppler-utils`, and **Ollama** installed on the host — matching `backend/agents/Dockerfile`'s system dependencies plus the LLM runtime the agentic core expects at `OLLAMA_URL`.
- Three independent jobs, each scoped to its own `working-directory`:
  - **backend-node**: `npm ci` + `npm run build` (tsc typecheck) + `npm test` (Jest, 10 files) in `backend/`.
  - **backend-python**: `pip install -r requirements.txt` + `pytest` (5 files) in `backend/`.
  - **frontend**: `npm ci` + `npm run lint` (ESLint) + `npm run format:check` (Prettier) + `npm run build` (tsc + Vite) + `npm test` (Vitest, 14 files) in `frontend/`.
- CI is **informative only** in this change: it reports status on PRs and commits but does not block merges. `main` branch protection is explicitly out of scope here (see Epic backlog below).
- Playwright e2e (3 specs) and any docker-compose service (Postgres/Redis/Chroma/MailDev) are explicitly **not** started in CI — confirmed unnecessary because the current suite fully mocks `ioredis` (Node) and `_call_ollama` (Python); adding live services is deferred until real integration tests need them.
- No new lint/format tooling is introduced for the Python side in this change (none exists today: no ruff/flake8/mypy config anywhere in the repo). The Python job runs tests only; adding Python linting is left as explicit backlog to avoid scope creep, per `docs/documentation-standards.md`.

## Epic: Continuous Integration

This is **change 1 of 3** in the informal "Continuous Integration" epic (OpenSpec has no native epic grouping; this section is the substitute):

1. **ci-pipeline-foundation** (this change): self-hosted runner + informative CI for the existing unit-test suite.
2. **ci-branch-protection** (future): once this pipeline has proven stable, require the three jobs as passing status checks before merge into `main` (a GitHub repo-settings change the project owner must apply themselves; this future change will document the exact settings).
3. **ci-e2e-pipeline** (future, not yet justified): bring up the full docker-compose stack in CI and run the 3 Playwright specs, once a real need for e2e-in-CI emerges.

## Capabilities

### New Capabilities
- `ci-pipeline`: Automated build/lint/test execution on a self-hosted GitHub Actions runner for every PR and push to `main`, covering the Node backend, Python agentic core, and frontend, without starting any live service dependency.

### Modified Capabilities
(none — no existing candidate-domain spec's requirements change)

## Impact

- **New files**: `.github/workflows/ci.yml`.
- **Infrastructure**: one machine configured as a GitHub Actions self-hosted runner (Node 20, Python 3.11, tesseract-ocr, poppler-utils, Ollama). No changes to `infra/docker-compose.yml` or any Dockerfile.
- **No code changes** to `backend/api`, `backend/agents`, `backend/knowledge_base`, or `frontend/src` — this change only adds automation around what already exists.
- **Docs**: `docs/development_guide.md`'s CI/CD placeholder note will be updated to point at the new workflow.

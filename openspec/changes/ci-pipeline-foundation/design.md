## Context

JobFinder has no CI today. All 32 existing test files (10 Jest, 5 Pytest, 14 Vitest, 3 Playwright) run only when a human runs them locally, and the project's own SDD process (`docs/openspec-tasks-mandatory-steps.md`) compensates for this by requiring a manually-produced verification report per change. `backend/` mixes a Node/TypeScript API gateway (`backend/api`, `backend/prisma`) with a Python/FastAPI agentic core (`backend/agents`, `backend/knowledge_base`) — there is no monorepo tool (root `package.json` is an empty stub), so each stack must be built/tested independently.

The project owner has confirmed a self-hosted GitHub Actions runner with **Ollama** installed, even though the current test suite fully mocks the LLM (`monkeypatch.setattr(extraction_service, "_call_ollama", ...)` in every Python test) and Redis (`jest.mock("ioredis", ...)` in the relevant Jest tests). The runner is being built ahead of need, anticipating real LLM-integration tests later in the epic.

## Goals / Non-Goals

**Goals:**
- Every push to `main` and every PR targeting `main` automatically runs: Node build + Jest, Python pytest, and frontend lint + format-check + build + Vitest.
- Establish a self-hosted runner capable of running Ollama, for this and future changes in the CI epic.
- Keep the change reversible and low-risk: CI is observational only, nothing is blocked yet.

**Non-Goals:**
- Blocking merges on CI status (that's `ci-branch-protection`, change 2 of the epic).
- Running Playwright e2e or any docker-compose service in CI (that's `ci-e2e-pipeline`, change 3, not yet justified).
- Introducing Python linting/formatting (no ruff/flake8/mypy exists today; adding one is a separate spec decision, not bundled here to avoid scope creep).
- Changing `infra/docker-compose.yml` or any Dockerfile.

## Decisions

**1. Self-hosted runner, not GitHub-hosted.**
Confirmed by the project owner. Alternative considered: GitHub-hosted runner (free, zero maintenance) — sufficient for today's fully-mocked suite, but rejected because the owner wants Ollama available for tests planned later in the epic, and prefers to build that infrastructure once rather than migrate the workflow twice.

**2. Three independent jobs (`backend-node`, `backend-python`, `frontend`) instead of one monolithic job.**
Each stack has its own dependency install and failure mode; running them in parallel gives faster, more legible feedback (a Python failure doesn't hide a frontend failure) and matches the existing physical separation of `backend/api` vs `backend/agents` vs `frontend/`.

**3. No live services (Postgres/Redis/Chroma/Ollama) started in CI for this change.**
Verified by reading the test files, not assumed: every Redis touchpoint in Jest is mocked, every Ollama call in pytest is monkeypatched. Starting real services now would add complexity (docker-compose orchestration inside the runner, port conflicts with the owner's local dev stack on the same machine) with no test currently exercising them.

**4. CI is non-blocking in this change.**
Alternative considered: enable required status checks immediately. Rejected — the owner wants to see the pipeline run clean on real PRs first before gating merges on it, which is a one-click GitHub Settings change deferred to `ci-branch-protection`.

**5. Mandatory SDD steps not applicable to this change are explicitly marked N/A, not omitted.**
Per `docs/openspec-tasks-mandatory-steps.md`: this change adds no HTTP endpoint (curl-testing step: N/A) and no user-facing UI flow (Playwright-MCP e2e step: N/A). The mandatory unit-test-and-verification step still applies, scoped to "the new CI workflow runs and all 32 existing tests pass under it."

## Risks / Trade-offs

- **[Risk] Self-hosted runner executes arbitrary workflow code on the owner's machine.** → Mitigation: this is a single-contributor repository (all branches are `rrangelsegura`'s own, no external forks send PRs). Still, the workflow should not use `pull_request_target`, and if the repo is ever made public or gains outside contributors, the runner must be re-evaluated before accepting PRs from forks.
- **[Risk] The runner is a single machine — if it's off or unreachable, CI silently stops running (queued, not failed).** → Mitigation: since CI is non-blocking in this change, a stalled runner degrades to today's status quo (manual verification), not a new failure mode. Revisit when `ci-branch-protection` lands.
- **[Risk] No Python lint/format gate means style drift is still possible for `backend/agents` and `backend/knowledge_base`.** → Mitigation: explicit backlog item, not silently accepted as "done."
- **[Trade-off] Building the runner+Ollama now serves no test that exists today.** → Accepted explicitly by the project owner as a deliberate front-loaded investment for the next epic change.

## Migration Plan

1. Provision the self-hosted runner machine: install Node 20, Python 3.11, `tesseract-ocr`, `poppler-utils`, Ollama; register it via GitHub → Settings → Actions → Runners → New self-hosted runner.
2. Add `.github/workflows/ci.yml` with the three jobs described above, targeting the self-hosted runner label.
3. Open a throwaway PR to confirm all three jobs run and pass against the current `main`.
4. Update `docs/development_guide.md`'s CI/CD placeholder to reference the new workflow.
5. Rollback: delete `.github/workflows/ci.yml` (or disable the runner) — no other system depends on this change, so rollback has zero blast radius.

**Decision confirmed:** the runner host is the project owner's own development machine (the same one running the local docker-compose stack). Consequence: CI only runs while this machine is on, and competes for CPU/RAM with local dev work — acceptable because CI is non-blocking in this change; revisit if `ci-branch-protection` makes an always-available runner a hard requirement.

## Open Questions

- Should `npm ci`/`pip install` steps cache dependencies between runs (`actions/cache`) to speed up the self-hosted runner, or is a cold install acceptable given it's not gating merges yet?
- Exact Ollama model(s) to pre-pull on the runner now, if any — or leave the Ollama install bare until `ci-e2e-pipeline` defines which model integration tests need.

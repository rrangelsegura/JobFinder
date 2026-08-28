## Context

JobFinder has no CI today. All 32 existing test files (10 Jest, 5 Pytest, 14 Vitest, 3 Playwright) run only when a human runs them locally, and the project's own SDD process (`docs/openspec-tasks-mandatory-steps.md`) compensates for this by requiring a manually-produced verification report per change. `backend/` mixes a Node/TypeScript API gateway (`backend/api`, `backend/prisma`) with a Python/FastAPI agentic core (`backend/agents`, `backend/knowledge_base`) — there is no monorepo tool (root `package.json` is an empty stub), so each stack must be built/tested independently.

The project owner initially confirmed a self-hosted GitHub Actions runner with **Ollama** installed, even though the current test suite fully mocks the LLM (`monkeypatch.setattr(extraction_service, "_call_ollama", ...)` in every Python test) and Redis (`jest.mock("ioredis", ...)` in the relevant Jest tests). That runner was built, registered, and used to find and fix three real CI bugs (see tasks.md §4.3) — but was then **deregistered and removed** after the owner raised a legitimate local-security concern about running a persistent, network-reachable runner on their own PC, especially once the repo was confirmed public. See "Decision 1 (revised)" below.

## Goals / Non-Goals

**Goals:**
- Every push to `main` and every PR targeting `main` automatically runs: Node build + Jest, Python pytest, and frontend lint + format-check + build + Vitest.
- ~~Establish a self-hosted runner capable of running Ollama~~ — superseded; use GitHub-hosted `ubuntu-latest` runners, free/unlimited for this public repo and structurally safer.
- Keep the change reversible and low-risk: CI is observational only, nothing is blocked yet.

**Non-Goals:**
- Blocking merges on CI status (that's `ci-branch-protection`, change 2 of the epic).
- Running Playwright e2e or any docker-compose service in CI (that's `ci-e2e-pipeline`, change 3, not yet justified).
- Introducing Python linting/formatting (no ruff/flake8/mypy exists today; adding one is a separate spec decision, not bundled here to avoid scope creep).
- Changing `infra/docker-compose.yml` or any Dockerfile.

## Decisions

**1. GitHub-hosted runner (`ubuntu-latest`), not self-hosted. (Revised)**
Originally decided as self-hosted (see history below), then **reversed** once real experience with it surfaced the actual cost: getting it green required fixing a stale-Prisma-client issue, a CRLF/LF mismatch from the machine's `core.autocrlf`, a broken `python` PATH resolution (shadowed by an unrelated tool's venv), `actions/setup-python` failing outright on this runner, needing an elevated terminal to install it as a service, and — most seriously — an incident where testing a fix accidentally mutated the owner's global Python packages and conflicted with unrelated tools they use (`pandas-profiling`, `scrapegraph-py`). Combined with the repo being public (fork-PR risk, even if GitHub's mandatory-approval gate mitigates it) and the owner's explicit concern about running a persistent runner on their personal machine, the self-hosted approach was abandoned. GitHub-hosted `ubuntu-latest` runners are free and unlimited for public repos, need zero maintenance, can't touch the owner's machine, and — since Linux checkouts don't have a CRLF/autocrlf concern and `actions/setup-python` works normally there — incidentally eliminate every Windows-self-hosted-specific bug found above. The runner was deregistered and its local installation deleted (see tasks.md §1).
*Original decision (superseded):* self-hosted runner, so Ollama would be available on it for tests planned later in the epic, avoiding migrating the workflow twice. In hindsight, "avoid migrating twice" was a weaker argument than the actual operational and security cost — and the eventual Ollama-dependent step (`ci-e2e-pipeline`) can install Ollama fresh inside the ephemeral hosted VM for just that job, or use a dedicated cloud VM rather than a personal machine, when it's actually needed.

**2. Three independent jobs (`backend-node`, `backend-python`, `frontend`) instead of one monolithic job.**
Each stack has its own dependency install and failure mode; running them in parallel gives faster, more legible feedback (a Python failure doesn't hide a frontend failure) and matches the existing physical separation of `backend/api` vs `backend/agents` vs `frontend/`.

**3. No live services (Postgres/Redis/Chroma/Ollama) started in CI for this change.**
Verified by reading the test files, not assumed: every Redis touchpoint in Jest is mocked, every Ollama call in pytest is monkeypatched. Starting real services now would add complexity (docker-compose orchestration inside the runner, port conflicts with the owner's local dev stack on the same machine) with no test currently exercising them.

**4. CI is non-blocking in this change.**
Alternative considered: enable required status checks immediately. Rejected — the owner wants to see the pipeline run clean on real PRs first before gating merges on it, which is a one-click GitHub Settings change deferred to `ci-branch-protection`.

**5. Mandatory SDD steps not applicable to this change are explicitly marked N/A, not omitted.**
Per `docs/openspec-tasks-mandatory-steps.md`: this change adds no HTTP endpoint (curl-testing step: N/A) and no user-facing UI flow (Playwright-MCP e2e step: N/A). The mandatory unit-test-and-verification step still applies, scoped to "the new CI workflow runs and all 32 existing tests pass under it."

## Risks / Trade-offs

- **[Risk, resolved by reversal] Self-hosted runner executes arbitrary workflow code on the owner's machine, and is a single point of both security exposure and availability failure.** Originally accepted with GitHub's mandatory fork-PR-approval gate as mitigation; **superseded by switching to `ubuntu-latest`**, which removes the risk entirely rather than mitigating it — no runner lives on the owner's machine anymore.
- **[Risk] No Python lint/format gate means style drift is still possible for `backend/agents` and `backend/knowledge_base`.** → Mitigation: explicit backlog item, not silently accepted as "done."
- **[Realized incident, now mitigated] Testing the self-hosted Python setup once ran `pip install` against the owner's real global Python, changing 6 shared package versions and conflicting with unrelated tools.** This is exactly the class of risk that GitHub-hosted ephemeral runners structurally prevent (each job gets a throwaway VM) — another concrete reason for the reversal in Decision 1.

## Migration Plan

1. ~~Provision the self-hosted runner machine...~~ **Done, then reverted.** The runner was provisioned, registered, used to find/fix 3 real CI bugs, then fully deregistered and deleted once the hosted-runner decision was made (tasks.md §1).
2. `.github/workflows/ci.yml` targets `runs-on: ubuntu-latest` for all three jobs, using `actions/setup-node@v4` and `actions/setup-python@v5` normally (no more absolute-path Python workaround).
3. Open a PR to confirm all three jobs run and pass against the current `main` — in progress on [PR #6](https://github.com/rrangelsegura/JobFinder/pull/6).
4. Update `docs/development_guide.md`'s CI/CD placeholder to reference the new workflow. Done.
5. Rollback: delete `.github/workflows/ci.yml` — no other system depends on this change, so rollback has zero blast radius.

**Decision (revised):** the runner is now GitHub-hosted (`ubuntu-latest`), not the owner's machine. CI runs regardless of whether the owner's PC is on, and doesn't compete with local dev work for resources.

**Decision confirmed:** `npm ci`/`pip install` steps use the built-in `cache` option of `actions/setup-node` and `actions/setup-python` (keyed on the respective lockfiles) — works the same way on hosted runners, using GitHub's own cache backend.

## Open Questions

- (Resolved) Ollama model pre-pulling is moot now — no self-hosted runner exists. When `ci-e2e-pipeline` needs a real LLM, it will either install Ollama fresh inside the ephemeral hosted VM for that job, or provision a dedicated cloud VM — never a personal machine.

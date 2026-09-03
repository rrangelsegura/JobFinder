## Why

CI (`ci-pipeline-foundation`, archived) runs on every PR and push to `main`, but it's purely informative: nothing stops a merge or a direct push when a job is red, and nothing today even requires a PR to touch `main` — several docs/archive commits this project has landed by pushing straight to `main`. This change closes that gap: `main` becomes a protected branch where the three CI jobs must pass and every change must go through a pull request, so a red pipeline can no longer be ignored or bypassed.

## What Changes

- Enable GitHub branch protection on `main`:
  - **Require a pull request before merging** — direct pushes to `main` (by anyone, including the repo admin) are no longer possible.
  - **Require status checks to pass before merging**, naming the three existing CI jobs: `backend-node`, `backend-python`, `frontend`.
  - **Require branches to be up to date before merging** (strict status checks) — a PR must be rebased/merged with the latest `main` before it can merge, so what's tested is what actually lands.
  - **Include administrators** — the rule applies without exception, including the project owner.
  - **Block force-pushes and branch deletion** on `main` (standard companion protections for a protected branch, not previously configured).
- No changes to the CI workflow itself (`.github/workflows/ci.yml` is untouched) — this change only makes its existing signal enforceable.

## Epic: Continuous Integration

This is **change 2 of 3** in the "Continuous Integration" epic (see `ci-pipeline-foundation`'s proposal for the full backlog):
1. `ci-pipeline-foundation` (done, archived) — CI pipeline, informative only.
2. **`ci-branch-protection`** (this change) — make it enforceable.
3. `ci-e2e-pipeline` (future, not yet justified) — Playwright + docker-compose in CI.

## Capabilities

### New Capabilities
- `ci-branch-protection`: `main` requires an up-to-date, passing pull request (three named status checks) before any merge, enforced for all users including administrators.

### Modified Capabilities
(none — this is a repository setting, not application behavior; no existing candidate-domain spec changes)

## Impact

- **GitHub repository settings**: a branch protection rule on `main` (via the GitHub API/`gh`, applied with the project owner's explicit confirmation of the exact settings above).
- **Workflow change for the project owner**: every future change to `main`, however small, now requires a branch + PR + green CI — no more direct `git push origin main`.
- **No code changes.**

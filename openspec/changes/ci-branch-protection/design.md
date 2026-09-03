## Context

`main` today has no branch protection at all: anyone with push access (in practice, just the repo owner) can push directly, force-push, or delete it. CI (`ci-pipeline-foundation`) has been running clean on `ubuntu-latest` for several days, including a deliberate red/green proof, so it has "proven stable" per that change's own deferred-scope note. The repo is public and single-contributor.

## Goals / Non-Goals

**Goals:**
- `main` cannot be updated except through a pull request whose three CI jobs (`backend-node`, `backend-python`, `frontend`) are passing and up to date with `main`.
- The rule applies to the repo admin too — no silent bypass.
- Configure this via the GitHub API (the owner's authenticated `gh` session already has admin rights on the repo), with the owner's explicit sign-off on the exact settings before applying.

**Non-Goals:**
- Requiring PR approvals/reviews — moot for a single-contributor repo; not configured.
- Changing the CI workflow itself.
- Enabling `ci-e2e-pipeline`'s Playwright/docker-compose checks — those don't exist as status checks yet, so they can't be required.

## Decisions

**1. Require PR + include administrators.**
Confirmed by the project owner (see conversation). Alternative considered: require status checks without requiring PRs — rejected because it's a no-op in practice (nothing stops a direct push to `main`, which is exactly the gap being closed, and is literally how the previous change's archive commits landed).

**2. Strict status checks (require branches to be up to date before merging).**
Not explicitly asked as a separate question but bundled as a sensible default: without it, a PR opened before a `main`-breaking merge could still merge afterward showing a stale green check. Low cost for a low-traffic repo (one contributor, a handful of PRs to date).

**3. Also block force-pushes and branch deletion on `main`.**
Standard companion settings for any protected branch; GitHub bundles these into the same API call. Not previously configured at all, so this closes a second, unrelated gap (accidental `git push --force` or `git push -d` to `main`) at zero extra cost.

**4. Apply via `gh api` (PUT `/repos/{owner}/{repo}/branches/main/protection`), not manually through the Settings UI.**
The owner's `gh` OAuth token already has `repo` scope (confirmed admin:true on this repo during `ci-pipeline-foundation`). Applying it programmatically is faster and leaves the exact configuration in this change's history for traceability, versus a UI click-through that leaves no record. The exact API payload is documented in `tasks.md` for anyone to reproduce or audit later.

## Risks / Trade-offs

- **[Risk] Locks the owner out of quick direct-to-main fixes**, including for this very project's own docs/archive commits (as done during `ci-pipeline-foundation`). → Accepted trade-off, explicitly chosen by the owner over the weaker "checks-only" alternative. Future doc-only changes will need a (fast, unreviewed) PR instead of a direct push.
- **[Risk] `include administrators: true` means even the owner can get stuck if CI is broken for an unrelated reason** (e.g., a flaky third-party GitHub Action). → Mitigation: the owner can disable the branch protection rule from Settings → Branches at any time if truly blocked; this is a config toggle, not a code change, so recovery is fast.
- **[Trade-off] Slightly more friction for trivial changes** (a typo fix now needs a branch + PR). → Accepted as the intended effect of "protection," not a side effect.

## Migration Plan

1. Apply the branch protection rule via `gh api` with the payload documented in `tasks.md`.
2. Verify by reading the rule back (`gh api repos/.../branches/main/protection`) and confirming it matches the intended configuration.
3. Verify enforcement: attempt a direct push to `main` from this session and confirm GitHub rejects it (proof, not assumption).
4. Rollback: `gh api -X DELETE repos/.../branches/main/protection` (or toggle off in Settings → Branches) — fully reversible, no data/schema involved.

## Open Questions

None — both decisions needed from the owner were confirmed before writing this design.

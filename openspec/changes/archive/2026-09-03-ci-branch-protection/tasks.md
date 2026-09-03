## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [x] 0.1 Create feature branch `feature/ci-branch-protection` from `main`
- [x] 0.2 Verify branch creation and current branch status

## 1. Confirm CI Job Names

- [x] 1.1 Confirmed via `gh api repos/rrangelsegura/JobFinder/commits/main/check-runs`: exact context names are `backend-node`, `backend-python`, `frontend` — matches plan

## 2. Apply Branch Protection

- [x] 2.1 Applied via `gh api -X PUT repos/rrangelsegura/JobFinder/branches/main/protection` with this payload:
  ```json
  {
    "required_status_checks": {
      "strict": true,
      "checks": [
        { "context": "backend-node" },
        { "context": "backend-python" },
        { "context": "frontend" }
      ]
    },
    "enforce_admins": true,
    "required_pull_request_reviews": null,
    "restrictions": null,
    "required_linear_history": false,
    "allow_force_pushes": false,
    "allow_deletions": false,
    "block_creations": false,
    "required_conversation_resolution": false,
    "lock_branch": false,
    "allow_fork_syncing": true
  }
  ```
- [x] 2.2 Read back and confirmed: `strict:true`, `contexts:[backend-node,backend-python,frontend]`, `enforce_admins:true`, `allow_force_pushes:false`, `allow_deletions:false`

## 3. Review and Update Existing Unit Tests (MANDATORY)

- [x] 3.1 N/A — no application code or test exists for a repository setting; nothing to update

## 4. Run Unit Tests and Verify Pipeline (MANDATORY)

- [x] 4.1 Verified: attempted `git push origin main` with a trivial scratch commit — rejected with `GH006: Protected branch update failed... 3 of 3 required status checks are expected`. Local commit discarded via `git reset --hard origin/main` (never reached the remote).
- [x] 4.2 Opened [PR #7](https://github.com/rrangelsegura/JobFinder/pull/7) — confirmed `mergeStateStatus: BLOCKED` while checks were pending
- [x] 4.3 All three checks passed; `mergeStateStatus` flipped to `CLEAN` immediately after
- [x] 4.4 Verification report: `openspec/changes/ci-branch-protection/specs/ci-branch-protection/reports/2026-08-28-step-4-branch-protection-verification.md`

## 5. Manual Endpoint Testing with curl — NOT APPLICABLE

- [x] 5.1 Marked N/A: this change adds no HTTP endpoint to the application

## 6. E2E Testing with Playwright MCP — NOT APPLICABLE

- [x] 6.1 Marked N/A: this change introduces no user-facing UI workflow

## 7. Update Technical Documentation (MANDATORY)

- [x] 7.1 Updated the "Continuous Integration" section of `README.md`: no longer "informative only," documents the protected-branch rule
- [x] 7.2 Updated `docs/development_guide.md`'s CI paragraph to match

## 8. Close Out

- [x] 8.1 Merged [PR #7](https://github.com/rrangelsegura/JobFinder/pull/7) into `main` (merge commit `8c3d498`), owner confirmed explicitly — first real merge under the new rule, and it correctly required going through a PR (this session could no longer push the archive commit directly to `main` either — see the change's own follow-up branch)
- [x] 8.2 Archiving via `openspec archive ci-branch-protection`

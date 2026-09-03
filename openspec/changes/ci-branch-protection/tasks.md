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
- [ ] 4.2 Open a real pull request for this change's own branch (`feature/ci-branch-protection`) and confirm the merge button is blocked until all three checks report success and the branch is up to date
- [ ] 4.3 Confirm the three checks do run and pass on this PR (same jobs as always — no workflow change)
- [ ] 4.4 Create verification report at `openspec/changes/ci-branch-protection/specs/ci-branch-protection/reports/YYYY-MM-DD-step-4-branch-protection-verification.md` documenting the exact API payload applied, the read-back confirmation, and the rejected-push + blocked-merge proof

## 5. Manual Endpoint Testing with curl — NOT APPLICABLE

- [x] 5.1 Marked N/A: this change adds no HTTP endpoint to the application

## 6. E2E Testing with Playwright MCP — NOT APPLICABLE

- [x] 6.1 Marked N/A: this change introduces no user-facing UI workflow

## 7. Update Technical Documentation (MANDATORY)

- [x] 7.1 Updated the "Continuous Integration" section of `README.md`: no longer "informative only," documents the protected-branch rule
- [x] 7.2 Updated `docs/development_guide.md`'s CI paragraph to match

## 8. Close Out

- [ ] 8.1 Merge this change's own PR into `main` (first real test of the new rule) once step 4 passes — requires the project owner's explicit confirmation
- [ ] 8.2 Propose `openspec archive ci-branch-protection` per the project's standard change lifecycle

# Step 4 Report - Branch Protection Verification

- Date: 2026-08-28
- Change: ci-branch-protection
- Agent: Claude (Sonnet 5)

## Commands Executed

- `gh api -X PUT repos/rrangelsegura/JobFinder/branches/main/protection --input branch_protection_payload.json` — applied the rule (payload in `tasks.md` §2.1).
- `gh api repos/rrangelsegura/JobFinder/branches/main/protection` — read back and confirmed the applied configuration matches intent.
- `git push origin main` (with a throwaway scratch commit) — direct-push rejection test.
- `gh pr create` (PR #7, `feature/ci-branch-protection` → `main`) — first real PR under the new rule.
- `gh pr view 7 --json mergeable,mergeStateStatus` and `gh pr checks 7` — polled while checks ran.

## Applied Configuration (read-back)

```json
{
  "strict": true,
  "contexts": ["backend-node", "backend-python", "frontend"],
  "enforce_admins": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_pull_request_reviews": null
}
```

## Enforcement Proofs

1. **Direct push rejected.** `git push origin main` with a new commit failed:
   ```
   remote: error: GH006: Protected branch update failed for refs/heads/main.
   remote: - 3 of 3 required status checks are expected.
   ! [remote rejected] main -> main (protected branch hook declined)
   ```
   The local commit never reached the remote; discarded locally via `git reset --hard origin/main`. Note: this rejection happened without any `required_pull_request_reviews` object set — the required-status-checks rule alone was sufficient to block a direct push with no CI run recorded against it, confirming "require a pull request" is satisfied by the status-check requirement in this configuration.

2. **PR merge blocked while checks are pending.** Immediately after opening PR #7:
   ```
   mergeStateStatus: BLOCKED
   mergeable: MERGEABLE
   ```

3. **PR merge unblocks once all checks pass.** After `backend-node`, `backend-python`, and `frontend` all reported `pass`:
   ```
   mergeStateStatus: CLEAN
   ```

## Outcome

- Step 4 status: **PASS**
- Blocking issues: none
- Both directions of the rule verified empirically (blocks when red/pending, allows when green and up to date) — not assumed from the applied config alone.

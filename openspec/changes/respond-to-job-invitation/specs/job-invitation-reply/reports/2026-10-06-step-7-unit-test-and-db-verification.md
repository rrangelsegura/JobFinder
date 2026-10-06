# Step 7 Report - Unit Tests and Database Verification

- Date: 2026-10-06
- Change: respond-to-job-invitation
- Agent: Claude (Claude Code cloud session)

## Commands Executed
- `cd backend && /tmp/venv/bin/python -m pytest agents/invitation_responder -q` (targeted)
- `cd backend && npx jest api/routes/invitations api/queue/invitationReply api/queue/handleInvitationReply api/lib/invitationErrors api/jobInvitationSchema` (targeted)
- `cd frontend && npx vitest run src/features/invitations src/features/workspace` (targeted)
- `cd backend && /tmp/venv/bin/python -m pytest -q` (full)
- `cd backend && npx jest` (full) and `npm run build` (tsc, clean)
- `cd frontend && npx vitest run` (full), `npm run lint`, `npm run format:check`, `npm run build`
- `cd backend && npx prisma migrate deploy` against a real local Postgres 16, then the SQL checks below

## Unit Test Results
| Suite | Before this change | After | New |
|---|---|---|---|
| pytest (backend/agents) | 81 passed | 111 passed | 30 |
| Jest (backend/api) | 87 passed | 132 passed | 45 |
| Vitest (frontend) | 67 passed | 84 passed | 17 |

- Targeted tests: 30 + 45 + 23 passed, 0 failed, 0 skipped.
- Full suites: 111 + 132 + 84 passed, 0 failed, 0 skipped. Existing tests were not modified (task 6.1), except `WorkspaceLayout.test.tsx`, which gained one test for the new nav link.
- Lint: 0 errors; 1 pre-existing warning in `frontend/src/components/ui/button.tsx` (react-refresh), unrelated to this change.
- Build and Prettier: clean.
- Runtime: pytest ~0.5s, Jest ~3.7s, Vitest ~9s. No flaky behavior observed.
- Note: the unit suites mock Prisma/BullMQ/Ollama by design (same as the existing CI), so they never touch the database.

## Database State Verification
Real Postgres 16 started locally (`pg_ctlcluster 16 main start`), database `jobfinder`, all migrations applied including `20261006000000_job_invitations` (applied cleanly).

- Pre-test baseline (candidates | job_invitations | resumes | skills | work_experiences): `0 | 0 | 0 | 0 | 0`
- Post-unit-test validation: `0 | 0 | 0 | 0 | 0` (no mutation, as expected from mocked suites)
- Live check of the persistence contract (rolled into this step because the unit suite cannot exercise Postgres):
  - Two manual submissions with `externalId` NULL for the same candidate: both inserted (spec: "Manual submissions may repeat") — PASS
  - Two rows with the same `(candidateId, source, externalId)` = `(…, linkedin_message, msg-1)`: second rejected with `duplicate key value violates unique constraint "job_invitations_candidateId_source_externalId_key"` (spec: "Automated duplicate is rejected") — PASS
  - Same `externalId` under a different `source`: allowed — PASS
  - Deleting the candidate removed all its `job_invitations` rows (`ON DELETE CASCADE`) — PASS
- State restored: Yes. Final counts `0 | 0 | 0 | 0 | 0`. Serial sequence values advanced (not restorable and not part of row state).
- Observation: `work_experiences`/`skills` have no `ON DELETE CASCADE` from `candidates` (pre-existing schema), so cleanup deleted those children first. Not changed here.

## Outcome
- Step 7 status: PASS
- Blocking issues: none

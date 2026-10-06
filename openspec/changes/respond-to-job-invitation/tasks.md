## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [x] 0.1 Create feature branch `feature/respond-to-job-invitation` from `main` (or use the branch assigned to the session, if any) — used the session's assigned branch `claude/keen-cannon-ek4yzd`
- [x] 0.2 Verify branch creation and current branch status

## 1. Data Model

- [x] 1.1 Add `InvitationSource` enum and `JobInvitation` model to `backend/prisma/schema.prisma` with unique `(candidateId, source, externalId)`
- [x] 1.2 Generate and review the Prisma migration (additive only)

## 2. Python Agent: `invitation_responder`

- [x] 2.1 Create `backend/agents/invitation_responder/` (`schemas.py`, `service.py`, `router.py`) and register it in `backend/agents/main.py`
- [x] 2.2 Pydantic schemas: `InvitationExtraction`, `CandidateSummary`, `ReplyDraftRequest`/`Response`
- [x] 2.3 Extraction prompt + one-retry with capped error summary; ignore signature taglines
- [x] 2.4 Drafting prompt (grounding rule, intent shaping, language mirroring); retry once on empty/too-short output

## 3. Node API

- [x] 3.1 `POST /invitations/reply-drafts` with validation (text 1–5000, intent enum) and auth
- [x] 3.2 `GET /invitations/reply-drafts/{jobId}` with phases `queued|parsing|drafting|saving`, `durationMs`, ownership check
- [x] 3.3 BullMQ worker: build bounded candidate summary, call agent, persist `JobInvitation`

## 4. Frontend

- [x] 4.1 "Invitation Replies" page: textarea, intent selector, limit handling
- [x] 4.2 Polling, phase messages, parsed summary, read-only draft, Copy, retry, "not sent" notice
- [x] 4.3 Navigation entry and API client

## 5. Tests (TDD — write failing tests first)

- [x] 5.1 Add the reference Baxter invitation as a shared fixture (verbatim text, `ñ`/`á` preserved)
- [x] 5.2 pytest: extraction schema validation, Baxter expected fields, tagline ignored, null for missing fields, retry once then fail (LLM mocked)
- [x] 5.3 pytest: drafting prompt contains grounding/intent/language rules; no ungrounded employer/skill; Spanish input → Spanish instruction
- [x] 5.4 Jest: POST validation (400/401/202), GET statuses and phases, cross-candidate 404, persistence, uniqueness rule
- [x] 5.5 Vitest: page states (disabled submit, progress, result, copy, failure/retry, not-sent notice)

## 6. Review and Update Existing Unit Tests (MANDATORY)

- [x] 6.1 Confirm no existing CV-upload/extraction tests are affected; update any shared fixtures or route registries touched

## 7. Run Unit Tests and Verify Database State (MANDATORY)

- [x] 7.1 Capture pre-test DB baseline, run targeted then full suites (Jest, pytest, Vitest), verify post-test DB state
- [x] 7.2 Create report `openspec/changes/respond-to-job-invitation/specs/job-invitation-reply/reports/YYYY-MM-DD-step-7-unit-test-and-db-verification.md`

## 8. Manual Endpoint Testing with curl (MANDATORY — agent executes)

- [x] 8.1 Submit the reference Baxter invitation (`intent: interested`) via curl, poll to `completed`, verify parsed fields and English draft addressed to "Alexis" — **run with a scripted Ollama stub (Ollama is unreachable from the sandbox); real-model behavior is NOT verified, see the step 8 report**
- [x] 8.2 Repeat with `request_more_info` and `decline`
- [x] 8.3 Error cases: blank text, >5000 chars, bad intent, no auth, another candidate's `jobId`
- [x] 8.4 Delete created `JobInvitation` rows to restore DB state; document commands and responses in the report

## 9. E2E Testing with Playwright MCP (MANDATORY — agent executes)

_Run with the project's `@playwright/test` runner (Playwright MCP not available in the session) and the same LLM stub — see the step 9 report._

- [x] 9.1 Paste the Baxter invitation in the page, submit, observe progress, verify summary/draft/Copy/"not sent" notice
- [x] 9.2 Verify failure + retry path and disabled-submit states
- [x] 9.3 Record results in the report

## 10. Update Technical Documentation (MANDATORY)

- [x] 10.1 `docs/api-spec.yml`: both endpoints and schemas
- [x] 10.2 `docs/data-model.md`: `JobInvitation` and `InvitationSource`
- [x] 10.3 `openspec/config.yaml`: add agent role `invitation_responder`
- [x] 10.4 Follow `docs/documentation-standards.md`

## 11. Close Out

- [ ] 11.1 Push branch and open PR (`main` is protected) — branch pushed; PR intentionally not opened until the owner asks
- [ ] 11.2 Confirm CI checks pass and PR is mergeable
- [ ] 11.3 Merge once the project owner confirms; then propose `openspec archive respond-to-job-invitation`

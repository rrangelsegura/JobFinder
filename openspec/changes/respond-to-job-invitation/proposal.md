## Why

Recruiters regularly reach out to candidates with a vacancy invitation (today, mostly via LinkedIn direct messages). Answering each one well — acknowledging the specific role and company, tying the reply to the candidate's real experience, and keeping the right tone — is repetitive and time-consuming, and unanswered invitations are lost opportunities.

This change is the first, deliberately small step: the candidate pastes an invitation as plain text and the system returns a structured reading of it plus a ready-to-send draft reply grounded in the candidate's stored profile. The follow-up feature (out of scope here) will feed this same capability from a daily process that monitors LinkedIn notifications and direct messages; the input contract is therefore designed around an invitation *text plus its source*, so the later automation only has to swap the source.

Reference test invitation (verbatim in the change's fixtures): a message from Alexis Aguiñaga (Senior Talent Acquisition Consultant, Baxter) to Rene about a *Business Intelligence Specialist* role in Bogotá, D.C., citing Rene's experience as Sr. Data Steward at Johnson & Johnson Innovative Medicine Latinoamérica.

## What Changes

- New async endpoint `POST /invitations/reply-drafts` (authenticated, candidate-scoped) accepting `invitationText` (required) and an optional `intent` (`interested` | `request_more_info` | `decline`, default `interested`). Returns `202` with a `jobId`.
- New polling endpoint `GET /invitations/reply-drafts/{jobId}` returning `processing | completed | failed` and, when completed, the parsed invitation and the draft reply.
- New Python agent `invitation_responder` (Agentic Core) that, with the local LLM (Ollama), (1) extracts structured invitation data validated by a Pydantic schema and (2) drafts the reply in the language of the invitation, using only facts present in the candidate profile.
- The draft is **never sent automatically**; it is returned for the candidate to review and copy.
- Each generated draft is persisted as a `JobInvitation` record (with `source = "manual_text"`) so the later LinkedIn monitor can reuse the table and de-duplicate by source.
- Minimal frontend page ("Invitation Replies") with a textarea, an intent selector, a progress state and a read-only draft with a copy button.

## Capabilities

### New Capabilities
- `job-invitation-reply`: parse a pasted vacancy invitation and generate a grounded draft reply via async job + polling.
- `job-invitation-reply-ui`: candidate-facing page to submit an invitation and view/copy the draft.

### Modified Capabilities
(none)

## Impact

- **Backend Node API**: new routes in `backend/api/routes/` (`invitations.ts`), queue worker reusing the existing BullMQ pattern, Prisma model `JobInvitation` + migration.
- **Python Agentic Core**: new package `backend/agents/invitation_responder/` (router, schemas, service) registered in `backend/agents/main.py`.
- **Frontend**: new route/page and API client.
- **Docs**: `docs/api-spec.yml`, `docs/data-model.md`, `openspec/config.yaml` (new agent role `invitation_responder`).
- **Out of scope**: reading LinkedIn, sending replies, linking invitations to `Position`/`Company`/`Application` records, multi-turn conversations with the recruiter.

## Context

- Hybrid architecture: Node.js gateway validates, authenticates and enqueues; the Python core runs LLM logic against Ollama (default `llama3:8b`, 8192-token context ceiling).
- CV extraction already established the async pattern (BullMQ job, `processing | completed | failed`, polling, `phase`, `durationMs`) and a schema-validated, one-retry LLM pattern with budget-capped retry prompts. This change reuses both rather than inventing new ones.
- Next feature: a daily LinkedIn monitor will produce invitation texts automatically. Nothing here may assume the text was typed by a person.

## Goals / Non-Goals

**Goals:**
- Turn a pasted invitation into a structured record and a high-quality draft reply.
- Ground the reply strictly in the candidate's stored profile (no invented skills, employers, salary or availability).
- Keep the input contract (`invitationText` + `source`) stable for the future LinkedIn automation.

**Non-Goals:**
- Scraping or calling LinkedIn; sending messages; scheduling.
- Linking to `Position`/`Company`/`Application` or running matching/gap analysis on the vacancy (a later change can chain `jd_parser` / `matching_engine`).
- Conversation threads or follow-ups.

## Decisions

**1. Async job + polling, same as CV extraction.** Local-LLM calls take tens of seconds; a synchronous request would hit gateway timeouts. Reusing the queue and status vocabulary keeps the frontend polling code and operations model uniform.

**2. One LLM call for parsing, one for drafting (two focused prompts), not one combined prompt.** With an 8192-token ceiling and a small local model, a combined "extract + write" prompt risks truncated JSON (the failure mode documented in `cv-extraction-retry-hardening`). Step 1 returns strict JSON validated by Pydantic (`recruiter_name`, `recruiter_title`, `company`, `role_title`, `location`, `language`, `candidate_name_in_greeting`, `call_to_action`); step 2 produces plain-text prose for the reply, so no JSON validation risk on the long output. Step 1 keeps the existing one-retry-with-capped-error-summary budget; step 2 retries once on empty/too-short output.

**3. Grounding via a compact candidate summary, not the full profile.** The Node layer sends a bounded summary (full name, current/most recent title and employer, top skills, total years if derivable) built from Prisma data. The drafting prompt instructs the model to mention only facts in that summary or in the invitation, and to reference the invitation's own claims (e.g. "your note about my data engineering background") rather than restating unverified ones.

**4. Reply language mirrors the invitation** (`language` extracted in step 1: `en`, `es`, …). The test invitation is English → English reply.

**5. `intent` shapes the reply but never commits the candidate to facts.** `interested` = express interest and propose a call; `request_more_info` = ask for JD, compensation range, modality, process; `decline` = polite thanks, keep door open. Salary, notice period and availability are never stated unless present in profile preferences.

**6. Persist a `JobInvitation` row** (`id`, `candidateId`, `source` enum `manual_text` | future `linkedin_message` | `linkedin_notification`, `externalId` nullable, `rawText`, parsed fields, `intent`, `draftReply`, `status`, `createdAt`). A nullable `externalId` with a unique `(candidateId, source, externalId)` index gives the future monitor idempotency without further migrations. Manual submissions leave `externalId` null.

**7. Draft is advisory.** The API has no send action; this protects against LLM mistakes reaching a recruiter and keeps the later LinkedIn "send" decision as its own, explicitly-specced change.

**8. Input limits.** `invitationText` is trimmed, required, max 5,000 characters (invitations are short; also protects the context budget). Over the limit → `400`.

## Risks / Trade-offs

- Small local model may paraphrase or flatter beyond the facts → mitigated by the grounding rule, tests asserting no unseen employer/skill appears, and the draft being review-only.
- Recruiter signature blocks contain marketing taglines ("This is where you can do your best work…") that can pollute parsing → the extraction prompt tells the model to ignore signature taglines; covered by the Baxter fixture.
- Names with diacritics (Aguiñaga) must round-trip intact through queue, DB and JSON → covered by a test.

## Migration Plan

1. Prisma migration adding `JobInvitation` and the `InvitationSource` enum (additive, no existing table touched).
2. Deploy Python agent endpoint, then Node route/worker, then frontend page.
3. Rollback: drop the route/page; the table is additive and can remain unused.

## Open Questions

- Should the future LinkedIn monitor auto-send replies for `decline`? Deferred to that change.

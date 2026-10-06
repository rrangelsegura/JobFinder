# Step 8 Report - Manual Endpoint Testing with curl

- Date: 2026-10-06
- Change: respond-to-job-invitation
- Agent: Claude (Claude Code cloud session)

## IMPORTANT LIMITATION: the LLM was a scripted stub
Ollama is unreachable from this sandbox (`ollama.com`, `registry.ollama.ai` blocked by the egress policy; the GitHub release download returned 403), so no real model could run. Everything else was real: Postgres 16, Redis 7, the Node API with its BullMQ worker, the Python FastAPI agent, and the real prompt assembly. Ollama was replaced by `fake_ollama.py` (scratchpad, not committed), which returns canned JSON/text and logs each prompt it receives.

**Consequence:** this verifies the plumbing, validation, persistence, prompts and error handling. It does NOT verify the quality, grounding or language behavior of llama3:8b. The draft texts below are canned. A run against real Ollama is still pending (see "Not verified").

## Environment
`POST/GET localhost:3000` (API) -> worker -> `localhost:8000` (agent) -> `localhost:11434` (stub). Test candidates were seeded directly in Postgres (verified e-mail) and logged in through `POST /auth/login`: Rene Rangel (Sr. Data Steward at Johnson & Johnson Innovative Medicine Latinoamérica; skills SQL, Data Engineering, Communication) and a second candidate with no profile.

## Results
| # | Request | Expected | Actual |
|---|---|---|---|
| 1 | `POST /invitations/reply-drafts` without cookie | 401 | 401 `Not authenticated.` |
| 2 | `invitationText: "   "` | 400 | 400 `invitationText is required and must not be blank.` |
| 3 | 5001-character text | 400 | 400 `invitationText must be at most 5000 characters.` |
| 4 | `intent: "send_it_now"` | 400 | 400 `intent must be one of: interested, request_more_info, decline.` |
| 5 | Baxter invitation, `intent: interested` | 202 then completed | 202 `{invitationId, jobId, status: "processing"}`; polled to `completed` in 139 ms |
| 6 | Same, `request_more_info` | completed | completed in 95 ms |
| 7 | Same, `decline` | completed | completed in 80 ms |
| 8 | Other candidate polls Rene's `jobId` | 404 | 404 (body does not reveal the job) |
| 9 | Unknown `jobId` | 404 | 404 |
| 10 | LLM stopped, valid request | job fails, user-facing message | `failed`, `error: "The reply assistant is temporarily unavailable. Please try again in a few minutes."`, `durationMs: 65`; raw reason (`The language model is unavailable.`) only in the API log; DB row `status = failed`, `draftReply` NULL |

### Parsed invitation returned for the Baxter text (from the stubbed extraction)
`recruiterName: "Alexis Aguiñaga"`, `recruiterTitle: "Senior Talent Acquisition Consultant"`, `company: "Baxter International Inc."`, `roleTitle: "Business Intelligence Specialist"`, `location: "Bogotá, D.C."`, `language: "en"`. Diacritics survived the full path (curl -> API -> Redis/BullMQ -> agent -> Postgres -> API).

### What the real pipeline sent to the model (draft step, intent `interested`)
The prompt, captured from the stub, contained the profile summary the Node worker built from Postgres:
```
Candidate profile (the ONLY facts you may state about the candidate):
Name: Rene Rangel
Current or most recent role: Sr. Data Steward at Johnson & Johnson Innovative Medicine Latinoamérica
Skills: SQL, Data Engineering, Communication

Vacancy mentioned: Business Intelligence Specialist at Baxter International Inc. (Bogotá, D.C.).
```
followed by the grounding rules (no invented employers/skills/years, no salary/notice period/availability), "write the reply in English", "address the recruiter by first name ("Alexis")", and the invitation text, which is marked as data, not instructions.

### Persisted rows (DB)
`manual_text | interested | completed | Alexis Aguiñaga | Baxter International Inc. | Bogotá, D.C. | draft 362 chars` and the equivalent for `request_more_info` and `decline`. Failed rows are marked `failed`.

### Draft returned for the reference invitation (CANNED by the stub — not model output)
```
Hi Alexis,

Thank you for reaching out about the Business Intelligence Specialist role at Baxter International Inc. It sounds like a great opportunity and my background as a Sr. Data Steward at Johnson & Johnson Innovative Medicine Latinoamérica makes me keen to learn more. I would be glad to set up a call to talk about the position.

Best regards,
Rene Rangel
```

## Cleanup
All test candidates, profile rows and invitations were deleted; counts returned to `0 | 0 | 0 | 0 | 0`. Local sessions in Redis are ephemeral.

## Not verified
- Real llama3:8b output: language mirroring, absence of invented facts, tagline handling, adherence to the 80-140 word guidance, and the JSON-validation retry rate on real output. Prompts and guardrails are unit-tested and the prompt content was inspected, but the model's behavior is unproven.
- Context-budget behavior at the 5000-character limit on the real 8192-token model.

## Outcome
- Step 8 status: PASS for API/worker/agent/DB behavior; real-LLM behavior NOT VERIFIED

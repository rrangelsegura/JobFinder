# Step 8: Manual / Real Verification

**Change:** `work-experience-detail`
**Date:** 2026-08-01

## 8.1 Rebuild and restart

`infra-backend-api-1` and `infra-backend-agent-1` restarted with the new code. Found and fixed a real deployment gap along the way: `backend/api`'s `node_modules` is baked into the container image, not bind-mounted, so running `prisma migrate dev` on the **host** regenerated the host's Prisma Client but left the **container's** client stale (missing the 4 new models entirely — `tx.project`, `tx.workExperienceResponsibility`, etc. were `undefined`). Fixed by running `npx prisma generate` **inside** `infra-backend-api-1` and restarting it. Worth carrying into `docs/backend-standards.md` or a deploy runbook: schema changes need `prisma generate` run inside the container, not just the host, in this dev-container setup.

## 8.2 / 8.3 Real extraction and replace-semantics — mixed result, real finding

**What works, confirmed for real (not mocked):** built a small synthetic CV (2 responsibilities, 2 projects each with achievements/stack) as an actual PDF, uploaded it through the real HTTP pipeline (`POST /uploads/cv` → OCR → LLM → persistence) for a fresh test candidate. Result: full success, verified directly in Postgres —

- `work_experiences`: 1 row (Acme Corp / Software Engineer)
- `work_experience_responsibilities`: 2 rows, correctly linked to that `workExperienceId`
- `projects`: 2 rows, correctly linked to that `workExperienceId`
- `project_achievements`: 3 rows, correctly linked to their respective `projectId`
- `project_stack_items`: 5 rows, correctly linked to their respective `projectId`

This confirms the schema, migration, cascade deletes, the interactive-transaction persistence, and the extraction prompt/schema design are all correct for realistically-sized input. (Test candidate and data cleaned up afterward.)

**What doesn't work, and why — a real capacity limitation, not a code bug:** re-processing the actual real CV used throughout this project's prior manual verification (candidates 10 and 17, 6 substantial work experiences) **consistently failed**, across 3 separate clean attempts, in 3 different ways:

1. `httpx.ReadTimeout` — Ollama didn't finish generating within the 300s timeout at all.
2. Schema validation failure: missing `start_date` fields, `projects: None` instead of `[]`.
3. Schema validation failure: JSON structurally corrupted — fragments of top-level key names (`'skills'`, `'languages'`) appearing as string values where `work_experience` objects should be.

Root cause, confirmed directly: `llama3:8b`'s native context window is **exactly 8192 tokens** (checked via `ollama show`) — the same value already used for `num_ctx`. There is no higher ceiling to raise for this model. Adding responsibilities/projects/achievements/stack to the extraction target substantially increases required output size for a CV with 6 detailed jobs, and this specific CV now sits at or beyond what an 8B model with an 8192-token combined input+output budget can reliably produce in one shot — sometimes it barely fits (one earlier attempt got a clean `200 OK`), most of the time it doesn't.

**The replace-semantics design held up under real repeated failure**: candidate 17's original 6 `work_experiences` were still present, completely unchanged, after every one of these failed attempts — confirmed directly in Postgres. The atomicity guarantee (delete-then-insert only commits if the whole transaction succeeds) worked exactly as designed against real, repeated, real-world failures, not just in mocked tests.

## 8.4 Documented real LLM behavior

Done above — this is not a case of "it just works," and forcing a pass wasn't attempted. See design.md's already-stated risk ("LLM under-populates the new nested structure on real CVs") — the actual failure mode observed is more severe than under-population: on a large-enough input, generation can fail to complete or produce structurally invalid JSON entirely, not just shallow/degraded structure.

## 8.5 Re-processing script against real candidates 10 and 17

Ran successfully (enqueues correctly, exactly one job per resume, confirmed via `docker exec ... reprocessExistingResumes.ts` producing "Re-enqueued extraction for 2 existing resume(s)." each of 3 times). The resulting extraction jobs are the ones that hit the capacity ceiling described above — the script itself is not at fault; it does exactly what it's supposed to (task 5.4/5.5 already unit-tested and confirmed correct).

**Neither candidate 10 nor candidate 17 currently has the new structured fields populated** — both remain in their pre-change state (candidate 17 keeps its original 6 `work_experiences` with empty `description` and no responsibilities/projects; candidate 10 still has zero `work_experiences`, unchanged from before this change, since its original extraction predates this session's fixes entirely).

## 8.6 Cleanup

Deleted the synthetic verification candidate, its resume/work-experience/project data, and the synthetic test PDF (both from the container and host scratch). Candidates 10 and 17 (real accounts) were left untouched throughout — their data was never successfully modified by any reprocessing attempt, by design.

## Outcome and Recommendation

The feature itself — schema, extraction prompt, persistence, reprocessing script — is correct and works end-to-end against the real system for realistically-sized input. It does **not** currently work for the specific real CV this project has used throughout its own manual verification, because that CV's size, combined with the richer extraction target, exceeds `llama3:8b`'s hard 8192-token context ceiling. This is an architecture/capacity decision, not something fixable by further prompt or schema tweaking within this change's scope. Options, none attempted here since they're bigger decisions than this change's approved scope:

1. Switch to a model with a larger native context window (e.g. a Llama 3.1-family tag) for extraction.
2. Split extraction into multiple smaller LLM calls (e.g. one call per work experience) instead of one call for the whole CV.
3. Accept this as a known limitation for large CVs for now and document it.

Flagging this to the user rather than picking one unilaterally.

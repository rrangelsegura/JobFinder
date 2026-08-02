## Why

`work-experience-detail` (complete, not yet archived) added responsibilities/projects/achievements/stack to CV extraction, but manual verification against this project's real 6-job CV found it genuinely fails: `llama3:8b`'s native context window is exactly 8192 tokens (confirmed via `ollama show`) — a hard model ceiling, not a tunable setting. The real CV consistently either timed out or produced structurally corrupted JSON, on both the first attempt and the retry, across 3 clean attempts. A small synthetic CV worked perfectly end to end, proving the schema/persistence design is sound — this is specifically an output-size/capacity problem for CVs with several detailed jobs. See `openspec/changes/work-experience-detail/specs/reports/2026-08-01-step-8-manual-verification.md`.

## What Changes

- Split CV extraction into two call types instead of one: a **flat** call (personal_info/education/work_experience-without-nested-detail/skills/languages/certifications — the same shape and worked example depth this codebase already ran reliably before `work-experience-detail`), followed by one **detail** call per work-experience entry (responsibilities + projects/achievements/stack for that one job only, given the full resume text again plus which job to focus on).
- **BREAKING (behavior change)**: per-job detail extraction failure is now tolerated. If one job's detail call fails validation even after its own retry, that job still persists with its flat fields intact and empty responsibilities/projects, while the rest of the CV persists normally — a deliberate, logged, partial departure from today's all-or-nothing failure guarantee, scoped only to per-job detail.
- OCR failure or the flat call's own failure after retry is **unchanged**: the whole job still fails and nothing is persisted, exactly as today.
- `router.py` and `backend/api/queue/cvExtractionProcessor.ts` require **zero changes** — the new multi-call orchestration is entirely contained inside `extraction_service.py`, which still returns one fully-merged `CvExtractionResult` (or raises once) to everything above it.
- Explicitly not pursued: text segmentation/chunking of the OCR'd resume per job (unnecessary — the failure was output size, not input size; resending the full resume text per call is fine and avoids inventing a new NLP problem), and batching multiple jobs into one detail call (start at one job per call; a future tuning knob, not built speculatively now).

## Capabilities

### New Capabilities
_None._

### Modified Capabilities
- `cv-extraction`: "Extraction Failure Handling" gains a carve-out for per-job detail failures (persist the job with empty detail, logged) while its existing all-or-nothing guarantee for OCR/flat-call failure is untouched; a new requirement specs the two-call architecture itself. **Note**: `work-experience-detail`'s own delta (which already modified "Extracted Field Coverage"/"Persistence and Embedding of Extraction Results" and added a re-processing requirement) is not yet archived/synced to `openspec/specs/cv-extraction/spec.md` — this proposal's delta is written against that unarchived content as the assumed baseline, same situation already hit with `candidate-email-verification`'s dependency on unarchived `candidate-authentication`. `work-experience-detail` should be archived before or as part of implementing this change.

## Impact

- **Backend agent**: `backend/agents/cv_analyst/extraction_service.py` (orchestration, new detail-call prompt/worked example, flat call's example shrinks back), `backend/agents/cv_analyst/schemas.py` (new `WorkExperienceDetailResult`), their tests (substantial rework, not just additions — the current "worked example depth" tests assume one combined call).
- **Not affected**: `router.py`, `backend/api/queue/cvExtractionProcessor.ts`, the Prisma schema, the frontend — none of these need to change.
- **Explicitly not a speed improvement**: worst-case Ollama call count rises from 2 (1 + 1 retry) to up to `2 + 2N` (N = work-experience entries; up to 14 for the real 6-job CV). No evidence of Ollama parallel-request configuration in this environment (checked: no `OLLAMA_NUM_PARALLEL`, no model currently loaded per `/api/ps`) — calls to the same local model very likely serialize. The goal is reliability (many small calls that reliably fit), not wall-clock speed, and total extraction time may get worse for CVs with many jobs. State this plainly so it isn't a later surprise.

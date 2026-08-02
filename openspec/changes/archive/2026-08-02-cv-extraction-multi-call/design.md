## Context

`extract_structured_data(resume_text)` today makes one Ollama call for the entire `CvExtractionResult`, retries once on validation failure with a refined (error-summarized, context-budgeted) prompt. `llama3:8b`'s context window is 8192 tokens total (input + output combined) — confirmed via `ollama show`, not a value we control. Before `work-experience-detail`, this one-call shape worked reliably in production. After it, a CV with 6 detailed jobs (this project's own real test CV) reliably fails: `httpx.ReadTimeout` at the 300s call timeout, or schema-validation failure with structurally corrupted JSON (fragments of top-level key names leaking into `work_experience` as string values) — on both the first attempt and the retry, across 3 separate clean manual-verification runs. A small synthetic CV (2 jobs, 2 projects) worked perfectly through the full real pipeline, isolating this to an output-size/capacity ceiling specific to CVs with several detailed jobs, not a design flaw in the schema or persistence layer.

## Goals / Non-Goals

**Goals:**
- Make extraction of CVs with several detailed work experiences reliably succeed, without depending on a larger context window than `llama3:8b` actually has.
- Keep the blast radius of this change inside `extraction_service.py` — no changes to the REST contract, the Node.js persistence layer, or the Prisma schema.
- Degrade gracefully: one problematic job's detail shouldn't sink the whole CV's extraction.

**Non-Goals:**
- Not a speed optimization — explicitly expected to be call-count-heavier and possibly slower wall-clock for CVs with many jobs (see Risks).
- Not building resume text segmentation/chunking — the failure is output-size, not input-size, so resending the full resume text per call is sufficient and avoids a new, harder NLP problem (reliably finding job boundaries in raw OCR text).
- Not building multi-job batching per detail call (e.g. 2-3 jobs/call) — starting at strictly one job per call; noted as a future tuning knob only if call-count/time trade-offs prove to matter in practice.
- Not switching LLM models or providers — a different, bigger decision the user has not made; this change works within the existing `llama3:8b` constraint.

## Decisions

**1. Two call types: "flat" (unchanged shape from before `work-experience-detail`) + "detail" (new, one per job).**
The flat call reverts to exactly the shape this codebase ran reliably before `work-experience-detail` — same fields, same proven-adequate worked-example depth. The detail call is new and small: given the job's identifying info (company/position/dates) plus the full resume text again, extract just that job's `responsibilities`/`projects`. Isolating the new, risky, nested part from the already-proven flat part is the whole point of the "surgical" approach chosen over alternatives (splitting every section, or a segment-then-extract two-pass design) — it reuses what's already known to work and only rebuilds what's new.

**2. Resend the full resume text per detail call; no segmentation.**
Considered and rejected building a per-job text chunker. The original failure is about required *output* size, not input size — the flat call already proves the full resume text as input is fine. A chunker would introduce a new, harder failure surface (misplaced job boundaries silently corrupting every downstream call) to solve a problem that doesn't need solving.

**3. Orchestration lives entirely inside `extract_structured_data()`.**
It calls the flat extraction (unchanged propagation: raises `LlmSchemaValidationError` on failure, exactly as today), then loops over the resulting `work_experience` list, calling the new per-job detail function for each and merging results back in before returning. `router.py` and `cvExtractionProcessor.ts` are unaware this happened — same one-call-in, one-result-out contract at every layer above `extraction_service.py`. This containment is deliberate: the riskiest, newest logic (multi-call orchestration, partial-failure handling) stays in the one place that already owns LLM-calling concerns, rather than leaking into the REST layer or the Node.js persistence layer.

**4. Per-job detail failure is absorbed, not propagated — a real, scoped exception to today's all-or-nothing guarantee.**
If a job's detail call fails validation after its own retry, that job keeps its flat fields and gets empty `responsibilities`/`projects` (already the default-empty shape from `work-experience-detail`'s schema — no special-casing needed there), and a `logger.warning` records it. The rest of the CV — every other job's detail, and every other section — persists normally. OCR failure and flat-call failure are **not** touched by this: both still fail the whole job with nothing persisted, unchanged. This trade favors "get most of the CV's value" over "all or nothing" specifically for the part of the schema most likely to hit a capacity edge case, while keeping the foundational data's existing strong guarantee intact.

**5. Each detail call gets its own independent retry-once, reusing the existing generic error-summarization logic unchanged.**
`_summarize_validation_errors`/`_MAX_RETRY_ERRORS_SHOWN` already operate generically on a Pydantic `ValidationError` regardless of which model is being validated — no changes needed there, just reused for the smaller `WorkExperienceDetailResult` model too.

## Risks / Trade-offs

- **[Trade-off]** Worst-case Ollama call count rises from 2 to up to `2 + 2N` (N = work-experience count; up to 14 for the real 6-job CV) → **Accepted**, not mitigated: the goal is reliability, not speed. Each call repeats prompt-prefill overhead (worked example + instructions), and total wall-clock time may be similar or worse than today's single large call, especially since there's no evidence of Ollama parallel-request configuration in this environment (no `OLLAMA_NUM_PARALLEL`; `/api/ps` shows no model currently loaded) — calls to the same local model very likely serialize rather than run concurrently. State this plainly; do not let anyone assume this change makes extraction faster.
- **[Risk]** Partial-detail persistence means a candidate's profile can now be silently incomplete (a job with no responsibilities/projects, indistinguishable in the data from a job that genuinely has none) → **Mitigation**: the `logger.warning` on absorption is the only signal today; this change does not add a candidate-facing or DB-level marker distinguishing "no detail found" from "detail extraction failed." Acceptable for now since nothing downstream (no UI) consumes this data yet, but worth revisiting if/when a UI is built on top of `WorkExperienceResponsibility`/`Project`.
- **[Risk]** Cross-job context is lost in the detail calls — the model no longer sees the whole CV at once for this part, so it can't cross-reference across jobs (e.g. tooling mentioned once in a summary but reused across jobs) → **Accepted**: low-value cross-referencing for this specific extraction task, not worth the complexity of preserving whole-CV context per call.

## Migration Plan

1. Land the orchestration + prompt/schema changes in `extraction_service.py`/`schemas.py` — no schema migration, no API contract change, so this is a pure code deploy.
2. Restart `backend-agent` (and re-run `prisma generate` inside `backend-api` if any schema drift exists, per the deployment gotcha found during `work-experience-detail`'s own manual verification — not expected here since no Prisma schema changes, but worth checking).
3. Re-run extraction against the real 6-job CV that failed before (via the existing re-processing script from `work-experience-detail`) and confirm it now succeeds for real, not just for a synthetic CV.
4. Rollback: revert the code change — no data or schema rollback needed since nothing about the persisted shape changes, only how it gets populated.

## Open Questions

- If call-count/time trade-offs prove painful in practice for very large CVs (10+ jobs), is batching multiple jobs per detail call (deferred as Non-Goal here) worth revisiting? Not blocking this change — flagged for later if real usage shows it's needed.

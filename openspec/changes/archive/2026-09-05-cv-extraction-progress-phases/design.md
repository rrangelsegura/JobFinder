## Context

`processCvExtractionJob` (`cvExtractionProcessor.ts`) is exactly two awaited steps: `callAgent()` (one HTTP call to the Python agent, which internally does OCR → LLM extraction (with its own internal retries) → embedding — router.py's own comment: "this endpoint owns OCR -> LLM extraction -> embedding") and `prisma.$transaction(...)` (persistence). Node has no visibility into what happens *inside* `callAgent()` — it's an opaque, potentially multi-minute HTTP request. This is the real ceiling on how granular phase reporting can honestly be without a bigger architecture change (see proposal.md's explicit Non-Goal).

`GET /uploads/cv/:jobId` (`uploadStatus.ts`) currently derives `status` purely from `job.getState()`, collapsing `waiting`/`delayed`/`active` into one `"processing"` bucket (`uploadStatus.ts`'s own comment says as much).

## Goals / Non-Goals

**Goals:**
- Distinguish "not started yet" from "the long agent call is running" from "almost done, saving."
- No new infrastructure — use BullMQ's own `job.updateProgress()`/`job.progress`, already available on every `Job` instance, nothing to install or configure.

**Non-Goals:**
- Phases inside the agent call (OCR vs. flat extraction vs. per-job details) — see proposal.md.
- Elapsed-time display — a related but separate gap, tracked as its own future change.
- Persisting phase history anywhere — it's live, transient job state, same as `status` already is.

## Decisions

**1. Exactly three processing phases: `queued`, `extracting`, `saving`.**
These are the only steps Node itself actually goes through — anything finer would be invented, not observed.

**2. Phase is derived, not stored redundantly with `status`.**
`status` stays exactly as it is today (`processing | completed | failed`) for backward compatibility with the existing spec/tests; `phase` is an additional field present only when `status === "processing"`. A client that ignores `phase` entirely sees no behavior change.

**3. `job.getState() === "active"` but `job.progress` not yet set → default to `"extracting"`.**
There's an unavoidable small window between the worker picking up a job and its first `updateProgress()` call resolving. `"extracting"` is the correct default since it's the first (and by far the longest) real phase — a candidate would almost never observe anything else in that window anyway.

**4. Frontend falls back to today's generic copy if `phase` is absent.**
Defensive, not just cautious: `job.progress` on an old, already-in-flight job (started before this change deployed) has no phase data, so the status endpoint would report `active` state with no stored progress — same "default to extracting" handling covers it, but the frontend's own fallback is a second, independent safety net.

## Migration Plan

1. Add the two `job.updateProgress({ phase: ... })` calls to `processCvExtractionJob`.
2. Update `uploadStatus.ts` to derive and include `phase` for `processing` responses.
3. Update `useCvExtractionStatus.ts`'s type and `UploadStatusIndicator.tsx`'s copy.
4. Rollback: revert the three files — `phase` is purely additive, nothing else depends on it.

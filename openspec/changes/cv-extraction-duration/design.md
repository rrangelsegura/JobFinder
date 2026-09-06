## Context

Every BullMQ `Job` already carries `timestamp` (set when `queue.add()` is called — i.e. the moment `POST /uploads/cv` enqueues it) and `finishedOn` (set the moment the worker resolves or rejects, i.e. `completed` or `failed`). Both are already read in this codebase's tests/types elsewhere in the BullMQ dependency; `uploadStatus.ts` just never used them.

## Goals / Non-Goals

**Goals:**
- Show the candidate a real, accurate number for how long their upload took, computed from data that already exists.

**Non-Goals:**
- Distinguishing queue-wait time from actual-processing time (`processedOn - timestamp` vs `finishedOn - processedOn`) — total wall-clock time since upload is what the candidate actually experienced and is what was asked for; splitting it out is unneeded complexity for this change.
- Showing duration in the failure UI copy (see proposal.md) — the field is still returned, just not surfaced there.
- Persisting duration anywhere — like `phase` before it, this is derived from live BullMQ job state, not stored.

## Decisions

**1. `durationMs = job.finishedOn - job.timestamp`, total wall-clock time.**
This is what the candidate actually waited, start (clicked upload) to finish (got a result) — not an internal breakdown of queue-wait vs. processing.

**2. Returned on both `completed` and `failed`, displayed only on `completed`.**
Symmetric on the backend (cheap, no reason to withhold it from failed responses — useful for support/debugging later), asymmetric on the frontend by deliberate choice (see proposal.md's Non-Goal).

**3. A small local formatter, not a new dependency.**
"42 seconds" / "3m 12s" is simple enough (two branches: under a minute vs. minutes+seconds) that pulling in a date-formatting library for it would be overkill — matches this codebase's existing preference for plain, minimal utility code over new dependencies for small formatting needs.

## Migration Plan

1. `uploadStatus.ts`: add `durationMs: job.finishedOn - job.timestamp` to both the `completed` and `failed` response branches.
2. `useCvExtractionStatus.ts`: add `durationMs?: number` to the type.
3. `UploadStatusIndicator.tsx`: format and display it in the success message.
4. Rollback: revert the three files — purely additive, nothing else depends on it.

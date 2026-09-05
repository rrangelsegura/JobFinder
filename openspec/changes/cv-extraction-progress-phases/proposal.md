## Why

Confirmed via full codebase/history audit: the CV upload status has always been a 3-value bucket (`processing | completed | failed`) — every intermediate BullMQ job state (waiting, delayed, active) collapses into a single "processing" with no visibility into what's actually happening. A candidate uploading a real, multi-page CV can watch a single spinner for several minutes with no indication whether it's queued, being analyzed, or being saved. This was never built, not something removed or deferred — it's genuinely new.

## What Changes

- The worker (`processCvExtractionJob`) reports two real phase transitions via BullMQ's own `job.updateProgress()`: `extracting` (before calling the Python agent — OCR, LLM extraction, and embedding all happen inside that one call, so this phase is intentionally coarse, not a lie about granularity we don't have) and `saving` (before the Prisma persistence transaction).
- `GET /uploads/cv/:jobId` gains a `phase` field alongside `status: "processing"`: `"queued"` (BullMQ state is `waiting`/`delayed` — not picked up yet), `"extracting"` or `"saving"` (BullMQ state is `active`, read from `job.progress`), defaulting to `"extracting"` in the brief window after the worker picks up a job but before its first progress update resolves.
- `UploadStatusIndicator` shows phase-specific copy: "Waiting to start…", "Analyzing your CV — this can take a few minutes…", "Saving your profile…" — falling back to today's generic "Processing your CV…" if `phase` is ever absent (keeps old behavior as the safe default, doesn't hard-require the new field).
- **Explicitly out of scope (a real architectural boundary, not a preference)**: finer-grained phases *inside* the agent call itself (e.g. "running OCR" vs "extracting job 3 of 6") — the Python agent doesn't talk to Redis today, and BullMQ progress is a Node-side API; splitting that call into visible sub-steps would mean either giving the Python service a Redis client to report its own progress, or restructuring the Node↔Python call boundary from one request into several. Both are real architecture changes, not this change's scope — noted here as the natural next step if finer granularity is wanted later.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `cv-extraction-status`: `GET /uploads/cv/{jobId}` gains a `phase` field for `processing` responses.
- `cv-upload-ui`: the processing indicator SHALL reflect the current phase, not just a generic "processing" state.

## Impact

- **Backend**: `backend/api/queue/cvExtractionProcessor.ts` (two `updateProgress` calls), `backend/api/routes/uploadStatus.ts` (derive and expose `phase`).
- **Frontend**: `useCvExtractionStatus.ts` (type), `UploadStatusIndicator.tsx` (phase-specific copy).
- No schema changes — phase is transient BullMQ job state, same as `status` already is.

## Why

Confirmed via full codebase/history audit: there has never been any way to see how long a CV's extraction took — no duration field in any API response, no timer anywhere in the frontend. A candidate who just watched "Analyzing your CV — this can take a few minutes…" (per `cv-extraction-progress-phases`) has no idea afterward whether it took 20 seconds or 4 minutes.

## What Changes

- `GET /uploads/cv/:jobId` includes `durationMs` on both `completed` and `failed` terminal responses — computed from two properties BullMQ already tracks on every job (`job.finishedOn - job.timestamp`), no new state to maintain.
- On success, `UploadStatusIndicator` shows the duration in human-readable form (e.g. "Processed in 42 seconds" / "Processed in 3m 12s") alongside the existing success message.
- **Deliberately not shown in the failure UI**: `durationMs` is still returned on failed responses (cheap, symmetric, useful for future debugging/telemetry), but the existing empathetic failure copy ("We ran into a problem…") isn't changed to include it — pairing a duration with an apology reads oddly and wasn't asked for; this keeps the failure-path UI exactly as `cv-upload-ui`'s existing spec already locks it down.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `cv-extraction-status`: `completed`/`failed` responses gain `durationMs`.
- `cv-upload-ui`: the success state displays the duration.

## Impact

- **Backend**: `backend/api/routes/uploadStatus.ts` only — `job.timestamp`/`job.finishedOn` are already present on every `Job` object, nothing else to compute or store.
- **Frontend**: `useCvExtractionStatus.ts` (type), `UploadStatusIndicator.tsx` (success copy + a small duration formatter).
- No schema changes, no worker changes — this change only reads BullMQ job metadata that already exists.

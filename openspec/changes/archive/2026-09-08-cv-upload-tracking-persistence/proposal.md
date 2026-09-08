## Why

Confirmed via manual testing against a freshly-reset stack (real Docker/Postgres/Redis, no stale caches involved): navigating away from the Upload page while an extraction job is in flight — even just to "Analysis Results" and back — silently loses all track of it. `UploadPage` keeps the tracked `jobId` in local component `useState`, which resets to `null` whenever the component unmounts on route change. The candidate returns to find the pristine, empty upload form, as if no upload had ever happened — even though the job is still processing, or has already completed successfully with a full extracted profile sitting in the backend.

This was reported as two symptoms that turned out to share one root cause:
1. "No veo el mensaje de la fase de carga" — if the candidate looks away from the Upload tab at any point during processing, the UI has already forgotten the job by the time they look back.
2. "Al volver a Upload no retoma el cargue" — confirmed directly: uploaded a CV, navigated to Analysis Results and back, and the Upload page showed the untouched upload form while the backend had already finished extraction (`durationMs: 45675`, full candidate payload) moments earlier.

## What Changes

- The tracked `jobId` is persisted to `localStorage`, scoped per candidate (`cv-extraction-job:{candidateId}`), and rehydrated whenever `UploadPage` mounts.
- Effect: navigating away and back (or reloading the page) within the same browser resumes tracking the same job — showing its current phase if still processing, or its final result (success with duration, or failure message) if it already finished while the candidate was away.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `cv-upload-ui`: job tracking survives navigating away from and back to the Upload page.

## Impact

- **Frontend only**: `UploadPage.tsx` (rehydrate/persist the tracked job id), a new small storage helper module. No backend or schema changes — the backend already has everything needed (`GET /uploads/cv/:jobId` is idempotent and already returns the current/final state for any valid job id).

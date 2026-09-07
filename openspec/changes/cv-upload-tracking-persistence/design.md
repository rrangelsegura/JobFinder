## Context

`GET /uploads/cv/:jobId` is already a pure, idempotent read of BullMQ job state (`cv-extraction-status` spec) — polling it with the same `jobId` at any later time returns the job's current state, whatever that is. The only thing standing between "leave and come back" working today and not working is that the client forgets which `jobId` to poll. `useCvExtractionStatus(jobId)` and `UploadStatusIndicator` need no changes at all — they already render correctly for any `jobId` they're given, in-flight or finished.

## Goals / Non-Goals

**Goals:**
- Surviving an SPA route change (leave Upload, come back) — the reported bug.
- Surviving a full page reload in the same browser, for free, since `localStorage` (unlike component state or `sessionStorage`-per-tab-instance) persists across both.

**Non-Goals:**
- A way to start a new upload once one has completed — today's UI already has no such control (`{!data && <CvUploadForm/>}` only renders the form when nothing has ever been tracked); this change makes that existing state durable across navigation, it doesn't add or remove the ability to re-upload. Out of scope; not what was reported.
- Cross-device/cross-browser sync — `localStorage` is inherently per-browser. A candidate checking from a different device/browser won't see the in-flight job. Server-side "does this candidate have an active job" tracking would fix that too, but is a bigger change than what today's bug calls for.
- Clearing the stored id on logout — it's already scoped per `candidateId`, so a different candidate logging into the same browser gets their own key and never sees someone else's job. A stale key for a candidate who's since logged out is inert (harmless, tiny, never read unless that same candidate logs back in).

## Decisions

**1. `localStorage`, keyed `cv-extraction-job:{candidateId}`, not a global key.**
Scoping by candidate id (available from the existing `useSession()`) means two different candidates sharing a browser never see each other's job — each key is independent. A single unscoped key would leak candidate A's `jobId` into candidate B's session.

**2. Rehydrate only once `candidateId` is known, not before.**
`useSession()` resolves asynchronously. Reading `localStorage` before `candidateId` is known would mean either using an unscoped fallback key (the leak this design avoids) or guessing. Instead, the stored job id is read in an effect that depends on `candidateId`, so it only ever reads the correctly-scoped key. This means there's a brief moment on first render (before the session query resolves) where the upload form flashes before the real state renders — the same class of brief-loading-flash this app already accepts elsewhere (e.g. `useSession`'s own `isLoading`), not a new pattern.

**3. A small `cvUploadJobStorage.ts` helper, not inline `localStorage` calls.**
`get`/`set` wrapped in `try/catch` (a private browsing mode or a user with storage disabled can throw on access) so a storage failure degrades to today's behavior (job tracking lost on navigation) rather than crashing the page. Keeping this in one small module also makes it directly unit-testable without mocking `localStorage` inside `UploadPage`'s own test file.

## Migration Plan

1. Add `frontend/src/features/upload/cvUploadJobStorage.ts` — `getStoredJobId(candidateId)`, `setStoredJobId(candidateId, jobId)`, wrapped in `try/catch`.
2. `UploadPage.tsx`: read `candidateId` from `useSession()` (already imports it for `accountEmail`), rehydrate `jobId` from storage in an effect keyed on `candidateId`, and persist new job ids through the same helper when `CvUploadForm` reports one.
3. Rollback: revert the two files — purely additive, `useCvExtractionStatus`/`UploadStatusIndicator` untouched.

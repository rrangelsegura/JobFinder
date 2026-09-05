## Why

"Analysis Results" has been a visibly disabled "Coming soon" nav placeholder since `candidate-workspace` (2026-07-30), even though the underlying extraction pipeline it's meant to display — education, work experience with responsibilities/projects/achievements/stack, skills with proficiency, languages, and certifications — has been complete and tested for weeks. A candidate can upload a CV and have it fully extracted, but has no way to ever see what the system found. Confirmed via full codebase/history audit: neither a results-rendering UI component nor a backend endpoint to fetch a candidate's persisted extraction data has ever existed at any point in this project.

## What Changes

- New backend endpoint `GET /candidates/me` — self-scoped to the authenticated candidate (via the existing `requireAuth` → `req.candidateId`, the same pattern `/auth/session` already uses), returning: personal info from the most recent resume that has completed extraction, plus the candidate's education, work experience (with responsibilities/projects/achievements/stack), skills (with proficiency), languages, and certifications. This reads live from Postgres — it does **not** rely on the BullMQ job's `returnvalue` that `/uploads/cv/:jobId` uses, which is transient job-queue state, not a durable data-access path.
- A `hasAnalysis: false` response when the candidate has never had a resume complete extraction — the frontend needs to distinguish "nothing yet" from "something, but empty."
- New frontend page `AnalysisResultsPage`, replacing the disabled "Analysis Results" placeholder: read-only display of the above, grouped into sections. Handles the empty state (no analysis yet — link back to Upload) and the populated state.
- `WorkspaceLayout`/`DisabledNavItem`: "Analysis Results" becomes a live, navigable nav item — only Chat and Action Plan remain disabled placeholders.
- **Out of scope for this change** (explicitly deferred, not silently dropped): editing any of the displayed data (matches this project's existing "no profile editing" known limitation, per `frontend/README.md`); showing extraction progress phases or elapsed processing time (separate, unbuilt capabilities identified alongside this one — not part of what "Analysis Results" itself needs to solve); handling multiple resumes with different data (existing candidate-scoped, not resume-scoped, data model limitation — unchanged here).

## Capabilities

### New Capabilities
- `candidate-analysis-results`: a self-scoped endpoint and a read-only frontend page displaying a candidate's persisted CV extraction results.

### Modified Capabilities
- `candidate-workspace-shell`: "Analysis Results" is no longer a disabled placeholder — it's live, functional navigation. Chat and Action Plan remain disabled.

## Impact

- **New backend file**: `backend/api/routes/candidates.ts` (new route, mounted alongside `auth`/`uploads`/`uploadStatus`).
- **New frontend files**: an `AnalysisResultsPage` and supporting components/hook under `frontend/src/features/analysis/`.
- **Modified**: `frontend/src/features/workspace/WorkspaceLayout.tsx` (un-disable one nav item), `frontend/src/routes/router.tsx` (new route).
- **No schema changes** — this change only reads existing tables.
- **Docs**: `docs/api-spec.yml` gains the real `GET /candidates/me` path (the existing generic `/candidates`/`/candidates/{id}` paths stay as-is — aspirational/unimplemented, unrelated cleanup, out of scope here).

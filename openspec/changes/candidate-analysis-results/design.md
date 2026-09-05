## Context

Every piece of data this page needs already exists in Postgres, candidate-scoped: `Education[]`, `WorkExperience[]` (with `responsibilities[]`/`projects[]`, each project with `achievements[]`/`stack[]`), `Skill[]` (with `proficiency`), `Language[]`, `Certification[]`. Personal info is resume-scoped (`Resume.extracted{FirstName,LastName,Email,Phone,Address}`), deliberately separate from `Candidate.{firstName,lastName,email}` (the login credential — see `candidate-authentication`/`candidate-email-verification` design docs).

The only existing way to see any of this today is the ephemeral `job.returnvalue` embedded in `/uploads/cv/:jobId`'s response while the BullMQ job history still holds it — not a durable, revisit-anytime data path. There is genuinely no `GET` endpoint anywhere in this codebase that reads a candidate's own persisted profile.

## Goals / Non-Goals

**Goals:**
- A candidate can see everything the system has extracted from their CV, any time, not just in the seconds after upload finishes.
- Read-only for this change.

**Non-Goals:**
- Editing extracted data (existing documented limitation, unchanged).
- Extraction progress phases or elapsed-time display (identified alongside this gap, but a different capability — that's about the Upload page's *in-flight* experience, not this page's *at-rest* display of what's already persisted).
- Resume-scoped (vs. candidate-scoped) data — unchanged existing model limitation.
- Building out Chat or Action Plan — they stay disabled placeholders.

## Decisions

**1. `GET /candidates/me`, self-scoped — not the existing generic `/candidates/{id}` already declared (unimplemented) in `docs/api-spec.yml`.**
`requireAuth` already resolves `req.candidateId` from the session, exactly like `/auth/session` uses it. A self-scoped route needs no authorization check beyond "is this session valid" — there's no `{id}` parameter to ever validate against the caller, so there's no IDOR surface to get wrong. The existing `/candidates/{id}` CRUD-shaped spec entries are a separate, still-unimplemented, more generic design from early in the project (`docs/api-spec.yml`) — left alone; reusing them would mean adding an ownership check this endpoint doesn't otherwise need.

**2. Reads live from Postgres on every request — no caching layer, no reliance on BullMQ job state.**
This is the entire point of the change: today's only "view" of extraction results is tied to job-queue retention, which is incidental infrastructure state, not a data-access guarantee. A direct Prisma query is simple, always correct (reflects whatever the last successful extraction actually persisted), and this data is small (one candidate's profile) with no performance concern.

**3. Personal info comes from the most recent `Resume` row with a non-null `extractedFirstName`.**
A candidate can upload more than once; only resumes that completed extraction have any extracted personal info. "Most recent one that actually has data" is the closest match to "current" without inventing a new "active resume" concept the data model doesn't have. If a candidate re-uploads and that new upload is still processing or fails, the previous successful resume's personal info still shows — consistent with "Analysis Results always reflects the last successful extraction," matching how the structured tables themselves behave (replace-on-success, not replace-on-upload).

**4. `hasAnalysis: false` as an explicit response field, not an inferred empty-arrays state.**
A candidate who registered but never uploaded anything, and a candidate whose one upload is still processing, both have zero `Education`/`WorkExperience`/etc. rows — indistinguishable from "extraction ran and genuinely found nothing" by row count alone. An explicit boolean (true only if at least one resume has `extractedFirstName` set) lets the frontend show "you haven't uploaded a CV yet, or it's still processing" honestly instead of a confusing blank "Education" section with nothing under it.

**5. One backend call, not one per section.**
All the data (education, work experience with nested responsibilities/projects, skills, languages, certifications) comes back in a single `GET /candidates/me` response via nested Prisma `include`s, rendered as one page with internal sections — not six separate endpoints/hooks. This is a single cohesive "profile," and the data volume is small; splitting it would only add round-trips for no benefit.

## Risks / Trade-offs

- **[Trade-off] No pagination on work experience/education lists.** Accepted: a CV realistically has single-digit counts of each; this isn't a growing, unbounded collection.
- **[Risk] If a candidate has zero resumes with `extractedFirstName` set but non-empty `Education`/`WorkExperience` rows from some other path, `hasAnalysis` could read `false` while data exists.** Not possible under the current pipeline (all structured data and resume personal info are written in the same transaction on successful extraction — see `cvExtractionProcessor.ts`), but worth naming: `hasAnalysis` is intentionally keyed off resume personal info, not off the structured tables, since it's the simplest single signal that also happens to always agree with them today.

## Migration Plan

1. Add `GET /candidates/me` (`backend/api/routes/candidates.ts`), mounted behind `requireAuth`.
2. Add `AnalysisResultsPage` + a `useAnalysisResults` hook (mirrors `useCvExtractionStatus`'s TanStack Query shape) under `frontend/src/features/analysis/`.
3. Wire the new route into `router.tsx` under the existing `/workspace` `ProtectedRoute` subtree.
4. Un-disable "Analysis Results" in `WorkspaceLayout.tsx`/remove it from `DISABLED_SECTIONS`.
5. Update `docs/api-spec.yml` with the real path.
6. Rollback: revert the route registration and nav change — re-disabling is a one-line revert, no data implications (read-only, no schema change).

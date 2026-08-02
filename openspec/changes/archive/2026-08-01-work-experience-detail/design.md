## Context

`WorkExperience` today is flat: `company`, `position`, `description` (free text), `startDate`, `endDate`, `candidateId`. Real CVs distinguish role-level responsibilities from specific projects, each project carrying its own achievements and tech stack — none of that has anywhere to land, and empirically doesn't: a real CV re-processed during `cv-upload-hardening` produced 6 `WorkExperience` rows with empty `description`.

No frontend renders `WorkExperience` data yet (Analysis Results is still "Coming soon"), so this is purely a data-model and extraction-pipeline change. Persistence for `WorkExperience` and its siblings (`Education`, `Skill`, `Language`, `Certification`) currently happens via `prisma.<model>.createMany(...)` calls collected into a `Prisma.PrismaPromise[]` and run through `$transaction(operations)` (the sequential-array form).

## Goals / Non-Goals

**Goals:**
- Capture responsibilities (role-level) and projects (with achievements + stack, project-level) as structured, queryable data.
- Retroactively fill this in for the (currently 2) candidates who already have extracted resumes.
- Keep the persistence transaction atomic — no partial writes on failure, same guarantee the pipeline already provides today.

**Non-Goals:**
- No frontend rendering of this data (nothing consumes it yet).
- No linkage between `ProjectStackItem` and the existing `Skill` entity — considered, rejected. They answer different questions (self-reported aggregate skills vs. CV-mined per-project usage) and forcing a shared taxonomy now is speculative.
- No changes to the `resumes_embeddings` vector pipeline. Feeding the new structured text into embeddings for RAG/matching is a natural follow-up but a separate concern from getting the data captured and persisted correctly.
- No multi-resume-per-candidate support. Re-processing assumes at most one live resume per candidate, matching current reality.

## Decisions

**1. Normalized child tables, not Postgres arrays, for responsibilities/achievements/stack.**
Chosen for consistency with the existing `Skill`/`Language`/`Certification` pattern — this codebase has already made this exact call three times for "list of things per candidate." Arrays would have been simpler to persist (no id-chaining problem) but break that precedent, give up stable per-item ids (useful if this data is ever editable from a future UI), and leave no room for future per-item metadata (e.g., a stack item someday wanting a proficiency/duration field) without a real migration later.

**2. `Project` is its own table (not folded into `WorkExperience` as more columns).**
A `WorkExperience` can have zero, one, or several projects; `Project` needs its own identity to own `ProjectAchievement`/`ProjectStackItem` children.

**3. Interactive transaction (`$transaction(async (tx) => {...})`) instead of the sequential-array form.**
The array form can't reference a just-created row's `id` in a later operation in the same array — but `Project` rows need their parent `WorkExperience.id`, and `ProjectAchievement`/`ProjectStackItem` need their parent `Project.id`. This forces `WorkExperience` and `Project` to be created individually (not via `createMany`) so their ids can be captured; `WorkExperienceResponsibility`, `ProjectAchievement`, and `ProjectStackItem` can still be `createMany`-ed per parent once its id is known. Applying this consistently, the whole function moves to the interactive form rather than mixing both transaction styles.

**4. Re-processing replaces, not accumulates, and happens inside the same transaction as the new writes.**
`WorkExperience`/`Education`/`Skill`/`Language`/`Certification` are keyed to `candidateId`, not `resumeId` — there's no way to tell which rows came from which resume. Re-running extraction and only inserting would duplicate everything. The fix: delete all of a candidate's existing rows across these five tables (cascading to the four new child tables) and insert the fresh result, **inside the same interactive transaction** as the insert — not as a separate destructive step beforehand — so a failed re-extraction never leaves a candidate with data deleted and nothing to replace it.

**5. Re-processing is a one-off script, not an API/admin action.**
Only 2 candidates currently have extracted data. Building a general "re-process this candidate" endpoint is speculative for a need that's happened once. A script that iterates existing `Resume` rows and re-enqueues (or directly invokes) the same extraction job path is enough; revisit if this becomes recurring.

## Risks / Trade-offs

- **[Risk]** The LLM under-populates the new nested structure on real CVs (same failure class `cv-upload-hardening` hit with skills/languages: a shallow worked example collapses under repetition) → **Mitigation**: worked example shows 2+ work experiences, 2+ projects on one, 2+ achievements/stack items per project; the existing retry-with-refined-prompt mechanism (`num_ctx`-budgeted, capped error summary) already in place applies here too, no new retry logic needed.
- **[Risk]** Destructive re-processing (delete-then-insert) could lose a candidate's data if done as two separate steps and the second fails → **Mitigation**: both happen inside one interactive transaction (Decision 4) — Postgres rolls back the delete if the insert fails.
- **[Risk]** Re-processing's replace-all assumption (at most one live resume per candidate) is already slightly fictional — the schema supports `Resume[]` per candidate — so this is deferred debt, not resolved debt → **Mitigation**: explicitly documented as a Non-Goal; if multi-resume support becomes real, replace-semantics must be revisited before it ships (not a silent landmine, a known one).
- **[Trade-off]** Moving to an interactive transaction changes how the persistence function is tested (mocking a `tx` callback vs. a flat operations array) → existing `cvExtractionProcessor.test.ts`-equivalent tests need rewriting, not just extending.

## Migration Plan

1. Add the 4 new tables via an additive Prisma migration (no changes to existing columns) — safe to deploy independently of the agent/API code changes if needed, since nothing reads/writes them yet.
2. Ship the agent (`schemas.py`/`extraction_service.py`) and API (`cvExtractionProcessor.ts`) changes together — the API's persistence code depends on the new nested shape the agent returns.
3. After deploy, run the one-off re-processing script against existing `Resume` rows (currently: candidates 10 and 17).
4. Rollback: schema change is purely additive — reverting the code leaves the new tables simply unused, no down-migration required for a safe rollback.

## Open Questions

- Should the new structured text (responsibilities, project achievements/stack) eventually feed `resumes_embeddings` for RAG/matching? Likely yes, but out of scope here — flagged as a natural follow-up change.

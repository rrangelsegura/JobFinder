## Why

`WorkExperience.description` is a single free-text field with no structure for responsibilities, projects, per-project achievements, or per-project tech stack — real CVs organize this information explicitly, and the LLM has nowhere structured to put it. This isn't theoretical: a real 5-page CV re-uploaded during `cv-upload-hardening`'s manual verification produced 6 `WorkExperience` rows with entirely empty `description` fields, because the extraction schema gave the model no structured place for that content.

## What Changes

- Add `WorkExperienceResponsibility` (role-level duties, list per `WorkExperience`) and `Project` (specific initiatives within a role, list per `WorkExperience`) as new normalized tables — consistent with the existing `Skill`/`Language`/`Certification` pattern (child tables of the owning record, not Postgres arrays).
- Add `ProjectAchievement` and `ProjectStackItem` as normalized child tables of `Project`.
- Extend the CV Analyst's extraction schema (`schemas.py`) and prompt/worked example (`extraction_service.py`) to produce this nested shape, with a worked example deep enough (2+ work experiences, 2+ projects on one of them, 2+ achievements/stack items per project) to hold under repetition on real CVs — the same lesson `cv-upload-hardening` already learned the hard way with skills/languages.
- Migrate `cvExtractionProcessor.ts`'s persistence from Prisma's sequential-array `$transaction(operations)` form to the interactive `$transaction(async (tx) => {...})` form, since nested creates (`WorkExperience` → `Project` → `ProjectAchievement`/`ProjectStackItem`) require each parent's generated `id` before creating its children — the array form cannot do this.
- **BREAKING (data semantics)**: re-process the CVs already uploaded so existing candidates get the new structured fields retroactively. Re-processing replaces — not accumulates — a candidate's `WorkExperience`/`Education`/`Skill`/`Language`/`Certification` records, since these are keyed by `candidateId` (not `resumeId`) and the current data has at most one live resume per candidate.

## Capabilities

### New Capabilities
_None._ This deepens data already inside `cv-extraction`'s existing scope; no new top-level capability.

### Modified Capabilities
- `cv-extraction`: "Extracted Field Coverage" now includes responsibilities and projects (with per-project achievements/stack) as part of the work-experience field group; "Persistence and Embedding of Extraction Results" now covers the new child records; a new requirement covers replace-semantics re-processing of already-uploaded resumes.

## Impact

- **Schema**: `backend/prisma/schema.prisma` (4 new tables + relations + migration), `docs/data-model.md`.
- **Backend agent**: `backend/agents/cv_analyst/schemas.py`, `backend/agents/cv_analyst/extraction_service.py`, their tests.
- **Backend API**: `backend/api/queue/cvExtractionProcessor.ts` (transaction-form migration), a new re-processing script/task, tests.
- **Out of scope**: frontend — no UI renders `WorkExperience` data yet (Analysis Results is still "Coming soon"). Linking `ProjectStackItem` to the existing `Skill` entity was considered and rejected — kept as an independent plain string, same simplicity level as `Skill.name`.

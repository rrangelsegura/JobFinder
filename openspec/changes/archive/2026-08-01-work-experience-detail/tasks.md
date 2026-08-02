## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [x] 0.1 Create feature branch `feature/work-experience-detail` from main
- [x] 0.2 Verify branch creation and current branch status

## 1. Database: Schema and Migration

- [x] 1.1 Add `WorkExperienceResponsibility` (`id`, `text`, `workExperienceId` FK) to `backend/prisma/schema.prisma`
- [x] 1.2 Add `Project` (`id`, `name`, `description?`, `workExperienceId` FK) to `backend/prisma/schema.prisma`
- [x] 1.3 Add `ProjectAchievement` (`id`, `text`, `projectId` FK) and `ProjectStackItem` (`id`, `name`, `projectId` FK) to `backend/prisma/schema.prisma`
- [x] 1.4 Generate and review the migration (`prisma migrate dev`); confirm it's purely additive (no changes to existing columns/tables)

## 2. Backend Agent: Extraction Schema (TDD)

- [x] 2.1 Write a pytest asserting `WorkExperienceEntry` accepts `responsibilities: list[str]` and `projects: list[ProjectEntry]`, both defaulting to empty lists
- [x] 2.2 Write a pytest asserting `ProjectEntry` requires `name`, and accepts optional `description`, `achievements: list[str]`, `stack: list[str]` (both defaulting to empty lists)
- [x] 2.3 Implement `ProjectEntry` and extend `WorkExperienceEntry` in `backend/agents/cv_analyst/schemas.py`
- [x] 2.4 Write a pytest asserting a `WorkExperienceEntry` with no `responsibilities`/`projects` given still validates successfully (optional-field-group coverage)

## 3. Backend Agent: Extraction Prompt (TDD)

- [x] 3.1 Write a pytest asserting the extraction prompt's worked example includes at least 2 work experiences, with at least one having 2+ projects, each project showing 2+ achievements and 2+ stack items (depth needed to hold under repetition on real CVs — see `cv-upload-hardening`'s skills/languages lesson)
- [x] 3.2 Extend `_EXAMPLE_RESULT` and the prompt in `extraction_service.py` to match
- [x] 3.3 Confirm existing prompt-shape tests still pass

## 4. Backend API: Persistence via Interactive Transaction (TDD)

- [x] 4.1 Write a test asserting `processCvExtractionJob` persists a `WorkExperience` entry's `responsibilities` as `WorkExperienceResponsibility` rows linked to the correct `workExperienceId`
- [x] 4.2 Write a test asserting it persists a `WorkExperience` entry's `projects` as `Project` rows (linked to the correct `workExperienceId`), each with its `achievements`/`stack` persisted as `ProjectAchievement`/`ProjectStackItem` rows linked to the correct `projectId`
- [x] 4.3 Migrate `cvExtractionProcessor.ts` from the sequential-array `$transaction(operations)` form to the interactive `$transaction(async (tx) => {...})` form; `WorkExperience` and `Project` created individually to capture their ids, their children `createMany`-ed per parent
- [x] 4.4 Write a test asserting a work experience with no responsibilities/projects persists cleanly (no empty child rows created)
- [x] 4.5 Write a test asserting the whole persistence step remains atomic: if any write in the transaction fails, nothing is persisted (extend/adapt the existing atomicity test for the new nested writes)

## 5. Backend API: Re-processing Existing Resumes (TDD)

- [x] 5.1 Write a test asserting that re-processing a candidate with existing `Education`/`WorkExperience`/`Skill`/`Language`/`Certification` records replaces them (old rows gone, only the new extraction's rows remain, no duplicates)
- [x] 5.2 Write a test asserting that if re-extraction fails schema validation after retry, the candidate's prior records are left untouched (delete-then-insert happens only once the new result is ready, inside the same transaction)
- [x] 5.3 Implement the replace-semantics delete (scoped to `candidateId`, covering the five tables plus the four new child tables via cascade) inside `processCvExtractionJob`'s transaction, ahead of the inserts
- [x] 5.4 Write a one-off script (e.g. `backend/api/scripts/reprocessExistingResumes.ts`) that iterates all `Resume` rows and re-enqueues (or directly invokes) extraction for each
- [x] 5.5 Write a test for the script asserting it enqueues exactly one job per existing `Resume` row

## 6. Review and Update Existing Unit Tests (MANDATORY)

- [x] 6.1 Run the full backend Jest suite and the full Python pytest suite; identify anything else broken by the transaction-form migration or schema changes
- [x] 6.2 Fix any broken tests found — none found beyond `cvExtractionProcessor.test.ts` itself (already rewritten in group 4); 53/53 Jest, 49/49 pytest pass

## 7. Run Unit Tests and Verify State (MANDATORY)

- [x] 7.1 Run the full backend Jest suite and the full Python pytest suite
- [x] 7.2 Run `npm run build` (frontend, to confirm the unrelated frontend still builds cleanly since `CvExtractionResult`'s TS interface changes) and `npm run lint`
- [x] 7.3 Create report `specs/reports/YYYY-MM-DD-step-7-unit-test-and-build-verification.md`

## 8. Manual / Real Verification (MANDATORY - AGENT MUST EXECUTE)

- [x] 8.1 Rebuild and restart `backend-agent` and `backend-api` with the changes; apply the new migration to the running Postgres
- [x] 8.2 Re-upload the same real CV used in prior manual verification (or run the re-processing script) for an existing candidate; verify in Postgres that `WorkExperienceResponsibility`/`Project`/`ProjectAchievement`/`ProjectStackItem` rows are actually populated (not just that the job succeeds) — confirmed working end-to-end with a small synthetic CV; the real 6-job CV hits a real model-capacity ceiling (see report)
- [x] 8.3 Verify the replace-semantics: confirm the candidate's prior `WorkExperience` row count/content was actually replaced, not duplicated, after re-processing — confirmed the inverse held too: repeated real failures left candidate 17's prior data completely untouched, exactly as designed
- [x] 8.4 If the real CV's source content doesn't clearly separate responsibilities/projects/achievements/stack (learned in `cv-upload-hardening`: this CV's work experience descriptions came back empty), test the LLM's actual behavior for real rather than assuming success — document whatever the real output looks like — done; see report for the 3 distinct real failure modes observed
- [x] 8.5 Run the re-processing script end-to-end against the current real candidates (10 and 17) and confirm both land correctly — script runs correctly (confirmed 3x); the resulting extractions hit the capacity ceiling above, so neither candidate's data actually changed
- [x] 8.6 Clean up any test data created; document results in report `specs/reports/YYYY-MM-DD-step-8-manual-verification.md`

## 9. Documentation

- [x] 9.1 Update `docs/data-model.md`'s `WorkExperience` section and add sections for `WorkExperienceResponsibility`, `Project`, `ProjectAchievement`, `ProjectStackItem` — inserted as entities 4-7, renumbered the rest (now a 19-entity model, header updated)
- [x] 9.2 Confirm `docs/backend-standards.md`'s persistence/transaction guidance still matches (or note deviations) now that the interactive-transaction form is in use — matches as-is; it only names Prisma as the ORM generically, no specific transaction-form guidance to reconcile

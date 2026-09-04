## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [x] 0.1 Created feature branch `feature/cv-extraction-schema-gaps` from `main`
- [x] 0.2 Verified current branch

## 1. Python: Schema and Prompt

- [x] 1.1 `schemas.py`: added `SkillEntry.proficiency: Optional[str] = None`
- [x] 1.2 `schemas.py`: changed `EducationEntry.start_date` to `Optional[date] = None`
- [x] 1.3 `extraction_service.py`: prompt now states `type` is classification-only (`technical`/`soft`), never a proficiency level; proficiency goes in the new `proficiency` field
- [x] 1.4 `extraction_service.py`: "omit end_date" guidance extended to cover start_date when unstated
- [x] 1.5 `extraction_service.py`: `_FLAT_EXAMPLE_RESULT` updated — AWS skill now has `proficiency="Advanced"`, Coursera education entry now has `start_date=None`

## 2. Python: Backend Tests (TDD)

- [x] 2.1 `test_schemas.py::test_education_start_date_is_optional`
- [x] 2.2 `test_schemas.py::test_skill_proficiency_is_optional_and_round_trips` + `test_skill_type_still_rejects_a_proficiency_level`
- [x] 2.3 `test_extraction_service.py::test_flat_example_demonstrates_skill_proficiency_and_optional_education_start` + `test_extraction_prompt_explains_skill_type_versus_proficiency`

## 3. Data Model

- [x] 3.1 `schema.prisma`: added `Skill.proficiency String? @db.VarChar(50)`
- [x] 3.2 `schema.prisma`: changed `Education.startDate` to `DateTime?`
- [x] 3.3 Migration `20260904193543_cv_extraction_schema_gaps` generated and applied; SQL confirmed additive (`DROP NOT NULL` + `ADD COLUMN`, no drops/renames)
- [x] 3.4 `docs/data-model.md` updated for `Skill`/`Education`

## 4. Node: Persistence

- [x] 4.1 `cvExtractionProcessor.ts`: `EducationEntry.start_date` → `string | null`
- [x] 4.2 `cvExtractionProcessor.ts`: guarded conversion — `startDate: e.start_date ? new Date(e.start_date) : null`
- [x] 4.3 `cvExtractionProcessor.ts`: `SkillEntry.proficiency` added and persisted in `skill.createMany`

## 5. Backend: Review and Update Existing Unit Tests (MANDATORY)

- [x] 5.1 `cvExtractionProcessor.test.ts::persists an education entry with no start date as a NULL startDate`
- [x] 5.2 `cvExtractionProcessor.test.ts::persists a skill's proficiency alongside its type`
- [x] 5.3 Confirmed: no existing test broke under the new optional fields (full suite green, see step 6)

## 6. Backend: Run Unit Tests and Verify Database State (MANDATORY)

- [x] 6.1 Full local suite green: 64 pytest (59 baseline + 5 new), 73 Jest (71 baseline + 2 new), 49 Vitest (unaffected)
- [x] 6.2 `npx prisma generate` + `npm run build` (backend) clean
- [x] 6.3 Verification report: `openspec/changes/cv-extraction-schema-gaps/specs/cv-extraction/reports/2026-09-04-step-6-7-unit-test-and-manual-verification.md`

## 7. Manual Endpoint Testing with curl (MANDATORY)

- [x] 7.1 Docker-compose stack running; migration applied to local dev DB; `backend-api` and `backend-agent` both restarted (Python has no hot-reload — required to pick up the schema/prompt changes)
- [x] 7.2 Re-enqueued the exact CV that produced job 20's original failure via `reprocessExistingResumes.ts` (resume id 2, candidate id 4) rather than re-uploading — same file, same code path
- [x] 7.3 Extraction completed successfully — `resumes.extractedFirstName` populated, no failure logged
- [x] 7.4 Verified in Postgres: 18 `Skill` rows for candidate 4 all have non-null `proficiency` (e.g. "SQL"/"Advanced") with correct `type: technical`; 2 `Education` rows both have `startDate: NULL` (source CV states only a graduation year), `endDate` correctly populated
- [x] 7.5 Documented in the same report as step 6

## 8. E2E Testing with Playwright MCP — NOT APPLICABLE

- [x] 8.1 Marked N/A: no frontend UI change; extraction results aren't rendered anywhere yet (Analysis Results is a disabled placeholder, per `frontend/README.md`)

## 9. Close Out

- [x] 9.1 Pushed branch, opened [PR #11](https://github.com/rrangelsegura/JobFinder/pull/11)
- [x] 9.2 All three CI checks passed; PR reached `mergeStateStatus: CLEAN`
- [x] 9.3 Merged into `main` (merge commit `4e0494d`), owner confirmed explicitly
- [x] 9.4 Archiving via `openspec archive cv-extraction-schema-gaps`

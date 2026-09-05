## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [ ] 0.1 Create feature branch `feature/work-experience-date-gaps` from `main`
- [ ] 0.2 Verify branch creation and current branch status

## 1. Python: Schema and Prompt

- [ ] 1.1 `schemas.py`: add a duration-phrase pattern/normalizer (English + Spanish: months/years/weeks/days, meses/años/semanas/días) that maps a bare duration string to `None`, wired into `_normalize_date_value` before the fuzzy `dateutil` fallback
- [ ] 1.2 `schemas.py`: change `WorkExperienceEntry.start_date` and `FlatWorkExperienceEntry.start_date` to `Optional[date] = None`
- [ ] 1.3 `extraction_service.py`: guard `_build_work_experience_detail_prompt`'s `date_range` construction against `start_date is None`
- [ ] 1.4 `extraction_service.py`: guard the retry-prompt `date_range` construction (inside `_extract_work_experience_detail`) the same way
- [ ] 1.5 `extraction_service.py`: extend the prompt's "omit start_date if unstated" guidance to explicitly cover work experience too, and add guidance that a stated duration (not an actual end date) should also result in omitting `end_date`

## 2. Python: Backend Tests (TDD)

- [ ] 2.1 `test_schemas.py`: `WorkExperienceEntry`/`FlatWorkExperienceEntry` without `start_date` succeed, `start_date is None`
- [ ] 2.2 `test_schemas.py`: a duration string (`"6 months"`, `"6 meses"`, `"2 years"`, `"3 años"`) normalizes `end_date` (and `start_date`) to `None`
- [ ] 2.3 `test_schemas.py`: confirm `test_start_date_still_rejects_genuinely_invalid_values` (or equivalent) still passes unchanged — genuinely nonsensical strings still fail validation
- [ ] 2.4 `test_extraction_service.py`: `_build_work_experience_detail_prompt` and the retry-prompt builder don't raise when `start_date` is `None`

## 3. Data Model

- [ ] 3.1 `schema.prisma`: change `WorkExperience.startDate` to `DateTime?`
- [ ] 3.2 Generate migration, verify the SQL is additive/non-destructive
- [ ] 3.3 `docs/data-model.md`: update the `WorkExperience` entry to match

## 4. Node: Persistence

- [ ] 4.1 `cvExtractionProcessor.ts`: `WorkExperienceEntry.start_date` type → `string | null`
- [ ] 4.2 `cvExtractionProcessor.ts`: guard the `Date` conversion for work experience the same way `EducationEntry.start_date` already is guarded

## 5. Backend: Review and Update Existing Unit Tests (MANDATORY)

- [ ] 5.1 `cvExtractionProcessor.test.ts`: add a case with a work experience entry with no `start_date` — persists with `startDate: null`
- [ ] 5.2 Confirm no existing test asserts `WorkExperience.startDate` in a way that breaks under the new optional field

## 6. Backend: Run Unit Tests and Verify Database State (MANDATORY)

- [ ] 6.1 Run the full local suite (Jest backend/, pytest backend/, Vitest frontend/) — confirm green
- [ ] 6.2 `npx prisma generate` + `npm run build` (backend) — confirm clean
- [ ] 6.3 Create verification report at `openspec/changes/work-experience-date-gaps/specs/cv-extraction/reports/YYYY-MM-DD-step-6-unit-test-and-db-verification.md`

## 7. Manual Endpoint Testing with curl (MANDATORY)

- [ ] 7.1 Ensure the docker-compose stack is running; apply the new migration to the local dev DB; restart `backend-api` and `backend-agent` (Python has no hot-reload)
- [ ] 7.2 Re-enqueue extraction for the CV that produced job 25's failure (via `reprocessExistingResumes.ts` or a fresh upload)
- [ ] 7.3 Poll extraction status until `completed`; confirm no schema-validation failure
- [ ] 7.4 Verify in Postgres: the affected `WorkExperience` rows have `startDate IS NULL` where unstated, and the two duration-only entries have `endDate IS NULL`
- [ ] 7.5 Document commands, responses, and DB query results in the same report as step 6

## 8. E2E Testing with Playwright MCP — NOT APPLICABLE

- [x] 8.1 Marked N/A: no frontend UI change; extraction results aren't rendered anywhere yet (Analysis Results is a disabled placeholder, per `frontend/README.md`)

## 9. Close Out

- [ ] 9.1 Push branch, open PR (required — `main` is protected)
- [ ] 9.2 Confirm all three CI checks pass and the PR is mergeable
- [ ] 9.3 Merge once step 6 and step 7 pass and the project owner confirms explicitly
- [ ] 9.4 Propose `openspec archive work-experience-date-gaps` per the project's standard change lifecycle

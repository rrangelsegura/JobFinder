## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [x] 0.1 Created feature branch `feature/work-experience-date-gaps` from `main`
- [x] 0.2 Verified current branch

## 1. Python: Schema and Prompt

- [x] 1.1 `schemas.py`: added duration-phrase pattern (English/Spanish months/years/weeks/days, plus hours — extended mid-verification once a certification's "40 horas" surfaced it), wired into `_normalize_date_value` before the fuzzy `dateutil` fallback
- [x] 1.2 `schemas.py`: `WorkExperienceEntry.start_date` and `FlatWorkExperienceEntry.start_date` → `Optional[date] = None`
- [x] 1.3 `extraction_service.py`: guarded `_build_work_experience_detail_prompt`'s `date_range` against `start_date is None`
- [x] 1.4 `extraction_service.py`: guarded the retry-prompt `date_range` construction the same way
- [x] 1.5 `extraction_service.py`: extended the "omit start_date if unstated" prompt guidance to work experience, and added duration-vs-end_date guidance (also mentions certifications, since that's where "40 horas" surfaced)
- [x] 1.6 (found during verification, not originally planned) `schemas.py`: added full Spanish month names to `_SPANISH_MONTH_ALIASES` (a real CV wrote "mayo, 2012", not the 3-letter abbreviation already handled)

## 2. Python: Backend Tests (TDD)

- [x] 2.1 `test_schemas.py::test_work_experience_start_date_is_optional` + `test_flat_work_experience_start_date_is_optional`
- [x] 2.2 `test_schemas.py::test_duration_only_end_date_normalizes_to_none` (parametrized: months/years/days/weeks, EN+ES) + `test_duration_only_start_date_normalizes_to_none` + `test_duration_only_certification_issue_date_normalizes_to_none`
- [x] 2.3 Confirmed `test_start_date_still_rejects_genuinely_invalid_values` still passes unchanged
- [x] 2.4 `test_extraction_service.py::test_work_experience_detail_prompt_handles_missing_start_date` + `test_extract_work_experience_detail_retry_handles_missing_start_date`
- [x] 2.5 (found during verification) `test_schemas.py::test_education_end_date_accepts_full_spanish_month_name`

## 3. Data Model

- [x] 3.1 `schema.prisma`: `WorkExperience.startDate` → `DateTime?`
- [x] 3.2 Migration `20260905152739_work_experience_date_gaps` generated and applied; SQL confirmed additive (`DROP NOT NULL` only)
- [x] 3.3 `docs/data-model.md` updated for `WorkExperience`

## 4. Node: Persistence

- [x] 4.1 `cvExtractionProcessor.ts`: `WorkExperienceEntry.start_date` → `string | null`
- [x] 4.2 `cvExtractionProcessor.ts`: guarded conversion — `startDate: w.start_date ? new Date(w.start_date) : null`

## 5. Backend: Review and Update Existing Unit Tests (MANDATORY)

- [x] 5.1 `cvExtractionProcessor.test.ts::persists a work experience entry with no start date as a NULL startDate`
- [x] 5.2 Confirmed: no existing test broke under the new optional field (full suite green, see step 6)

## 6. Backend: Run Unit Tests and Verify Database State (MANDATORY)

- [x] 6.1 Full local suite green: 78 pytest, 74 Jest, 49 Vitest
- [x] 6.2 `npx prisma generate` + `npm run build` (backend) clean
- [x] 6.3 Verification report: `openspec/changes/work-experience-date-gaps/specs/cv-extraction/reports/2026-09-05-step-6-7-unit-test-and-manual-verification.md`

## 7. Manual Endpoint Testing with curl (MANDATORY)

- [x] 7.1 Docker-compose stack running; migration applied; `backend-api`/`backend-agent` restarted (Python has no hot-reload) — done 3 times as the fix expanded through real-CV verification
- [x] 7.2 Re-enqueued the exact CV that produced job 25's original failure via `reprocessExistingResumes.ts` (resume id 4, candidate id 4)
- [x] 7.3 Extraction completed successfully on the final iteration — `resumes.extractedFirstName = "Rene"`, no failure logged
- [x] 7.4 Verified in Postgres: the duration-only job has `startDate`/`endDate` both NULL; both certifications have `issueDate` NULL; both education rows have `startDate` NULL and correctly-parsed `endDate` (including "mayo, 2012" → `2012-05-01`)
- [x] 7.5 Documented in the same report as step 6, including the two additional fixes found mid-verification

## 8. E2E Testing with Playwright MCP — NOT APPLICABLE

- [x] 8.1 Marked N/A: no frontend UI change; extraction results aren't rendered anywhere yet (Analysis Results is a disabled placeholder, per `frontend/README.md`)

## 9. Close Out

- [x] 9.1 Pushed branch, opened [PR #13](https://github.com/rrangelsegura/JobFinder/pull/13)
- [x] 9.2 All three CI checks passed; PR reached `mergeStateStatus: CLEAN`
- [x] 9.3 Merged into `main` (merge commit `3e8dffa`), owner confirmed explicitly
- [x] 9.4 Archiving via `openspec archive work-experience-date-gaps`

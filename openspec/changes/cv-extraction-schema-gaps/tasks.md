## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [ ] 0.1 Create feature branch `feature/cv-extraction-schema-gaps` from `main`
- [ ] 0.2 Verify branch creation and current branch status

## 1. Python: Schema and Prompt

- [ ] 1.1 `schemas.py`: add `SkillEntry.proficiency: Optional[str] = None`
- [ ] 1.2 `schemas.py`: change `EducationEntry.start_date` to `Optional[date] = None`
- [ ] 1.3 `extraction_service.py`: update the prompt to state `type` is classification-only (`technical`/`soft`), never a proficiency level, and that a stated proficiency goes in `proficiency`
- [ ] 1.4 `extraction_service.py`: update the "omit end_date" guidance to also cover start_date when unstated
- [ ] 1.5 `extraction_service.py`: update `_FLAT_EXAMPLE_RESULT` worked example — add `proficiency` to one skill, remove `start_date` from one education entry

## 2. Python: Backend Tests (TDD)

- [ ] 2.1 `test_schemas.py`: `EducationEntry` without `start_date` succeeds, `entry.start_date is None`
- [ ] 2.2 `test_schemas.py`: `SkillEntry` with `proficiency` set round-trips correctly; `SkillEntry` without `proficiency` defaults to `None`
- [ ] 2.3 `test_extraction_service.py`: confirm the worked example (`_FLAT_EXAMPLE_RESULT`) itself still validates against `CvExtractionFlatResult` after the prompt/example changes

## 3. Data Model

- [ ] 3.1 `schema.prisma`: add `Skill.proficiency String? @db.VarChar(50)`
- [ ] 3.2 `schema.prisma`: change `Education.startDate` to `DateTime?`
- [ ] 3.3 Generate migration (`prisma migrate dev --name cv_extraction_schema_gaps` or equivalent), verify the SQL is additive/non-destructive
- [ ] 3.4 `docs/data-model.md`: update `Skill` and `Education` entries to match

## 4. Node: Persistence

- [ ] 4.1 `cvExtractionProcessor.ts`: `EducationEntry.start_date` type → `string | null`
- [ ] 4.2 `cvExtractionProcessor.ts`: guard the `Date` conversion — `startDate: e.start_date ? new Date(e.start_date) : null`
- [ ] 4.3 `cvExtractionProcessor.ts`: `SkillEntry` interface gains `proficiency?: string | null`; persist it in the `skill.createMany` call, matching how `language.createMany` already persists `proficiency`

## 5. Backend: Review and Update Existing Unit Tests (MANDATORY)

- [ ] 5.1 `cvExtractionProcessor.test.ts`: add a case with an education entry with no `start_date` — persists with `startDate: null`
- [ ] 5.2 `cvExtractionProcessor.test.ts`: add a case with a skill carrying `proficiency` — persists alongside `type`
- [ ] 5.3 Confirm no existing test asserts `Education.startDate`/`Skill` shape in a way that breaks under the new optional fields

## 6. Backend: Run Unit Tests and Verify Database State (MANDATORY)

- [ ] 6.1 Run the full local suite (Jest backend/, pytest backend/, Vitest frontend/) — confirm green
- [ ] 6.2 `npx prisma generate` + `npm run build` (backend) — confirm clean
- [ ] 6.3 Create verification report at `openspec/changes/cv-extraction-schema-gaps/specs/cv-extraction/reports/YYYY-MM-DD-step-6-unit-test-and-db-verification.md`

## 7. Manual Endpoint Testing with curl (MANDATORY)

- [ ] 7.1 Ensure the docker-compose stack (postgres/redis/chroma/maildev/backend-api/backend-agent) is running; apply the new migration to the local dev DB
- [ ] 7.2 Re-upload the CV that produced job 20's failure (or an equivalent real CV with skill proficiency levels and an education entry without a start date) via `POST /uploads/cv`
- [ ] 7.3 Poll `GET /uploads/cv/:jobId` until `status: completed`; confirm no schema-validation failure
- [ ] 7.4 Verify in Postgres: the affected `Skill` row has a non-null `proficiency`, and the affected `Education` row has `startDate IS NULL`
- [ ] 7.5 Document commands, responses, and DB query results in the same report as step 6 (or a dedicated one)

## 8. E2E Testing with Playwright MCP — NOT APPLICABLE

- [x] 8.1 Marked N/A: no frontend UI change; extraction results aren't rendered anywhere yet (Analysis Results is a disabled placeholder, per `frontend/README.md`)

## 9. Close Out

- [ ] 9.1 Push branch, open PR (required — `main` is protected)
- [ ] 9.2 Confirm all three CI checks pass and the PR is mergeable
- [ ] 9.3 Merge once step 6 and step 7 pass and the project owner confirms explicitly
- [ ] 9.4 Propose `openspec archive cv-extraction-schema-gaps` per the project's standard change lifecycle

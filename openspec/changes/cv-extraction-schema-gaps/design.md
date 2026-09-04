## Context

Found via `docs/openspec-tasks-mandatory-steps.md`-style manual verification — a real uploaded CV, not a fixture. The exact Pydantic errors:
```
education.0.start_date / education.1.start_date
  Input should be a valid date [type=date_type, input_value=None, input_type=NoneType]
skills.5.type ... skills.26.type (12 occurrences)
  Input should be 'technical' or 'soft' [type=enum, input_value='intermediate'|'basic'|'advanced'|'scrum', ...]
```
Confirmed the `None` for `start_date` is not a normalization gap: `_normalize_partial_date` only transforms strings and passes `None` through unchanged, so the LLM genuinely emitted `null` — it correctly reported "not stated" rather than fabricating a date. `_normalize_ongoing_date`/`_normalize_partial_date` in `schemas.py` already exist for exactly this class of real-CV-shape problem (see their own inline comments); this change extends the same philosophy to two more fields.

## Goals / Non-Goals

**Goals:**
- Let extraction succeed for a CV with skills that state a proficiency level, and for a CV where an education entry has no stated start date.
- Follow the exact precedent already set by `Language.proficiency` and `end_date`'s optionality — no new design pattern introduced.

**Non-Goals:**
- Touching `WorkExperienceEntry`/`FlatWorkExperienceEntry.start_date` — not observed as a problem, stays required.
- Adding proficiency *levels* as a constrained enum (e.g. beginner/intermediate/advanced) — `Language.proficiency` is free-text (`String?`), so `Skill.proficiency` matches that exactly rather than inventing a stricter shape for one and not the other.
- Retrying/re-running the failed job 20 automatically — out of scope; the candidate can just re-upload once this ships.

## Decisions

**1. `Skill.proficiency` as free-text `String?`, not an enum.**
Matches `Language.proficiency` exactly (also free-text). Real CVs phrase proficiency inconsistently ("Advanced", "5 years", "Intermediate", "Fluent") — the same reasoning that already justified `Language.proficiency` being free-text applies identically here.

**2. `EducationEntry.start_date` → `Optional[date]`, not a placeholder/sentinel date.**
Consistent with how `end_date` already works for both `Education` and `WorkExperience`: "we don't know" is represented as `None`/`NULL`, never a fabricated value. A sentinel (e.g. epoch date) would silently corrupt any future "years of study" calculation.

**3. Prompt change is additive guidance, not a schema-only fix.**
Widening the schema alone would silently accept the LLM's current confused behavior (still putting proficiency in `type` sometimes, since `type` remains required) rather than steering it toward the new field. The prompt is updated to explicitly define `type` as classification-only and point proficiency language at the new field, plus the worked example gains a skill with `proficiency` set — this codebase's established pattern (per `cv-upload-hardening`'s and `work-experience-detail`'s design docs) is that the worked example, not prose alone, is what actually shapes real LLM output.

## Risks / Trade-offs

- **[Risk] `type` may still occasionally be wrong even with the prompt fix** (LLMs aren't deterministic). → Mitigation: not attempting to eliminate this class of error entirely — Pydantic validation + the existing one-retry-with-refined-prompt mechanism remains the safety net; this change only removes one specific, confirmed, systematic cause of it.
- **[Risk] Widening `Education.startDate` to nullable could hide a genuinely bad extraction (LLM giving up rather than trying).** → Accepted: the alternative (hard-failing the whole job) is strictly worse for the candidate, and `end_date` already accepts the same trade-off with no reported problems.

## Migration Plan

1. Update `backend/agents/cv_analyst/schemas.py`: `SkillEntry.proficiency`, `EducationEntry.start_date` → `Optional[date] = None`.
2. Update `extraction_service.py`: prompt wording + worked example (add a skill with `proficiency`, an education entry with no `start_date`).
3. Update `backend/prisma/schema.prisma`: `Skill.proficiency String? @db.VarChar(50)`, `Education.startDate DateTime?`. Generate migration.
4. Update `cvExtractionProcessor.ts`: types + persistence for both fields.
5. Update `docs/data-model.md`.
6. Rollback: revert the four files + drop the migration — no data has been written under the new shape yet (job 20 never persisted, per the all-or-nothing guarantee).

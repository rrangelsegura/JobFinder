## Why

Manual end-to-end testing with a real CV (uploaded by the project owner during a live manual test session) failed extraction job 20 with 18 Pydantic validation errors, all from the same two root causes:

1. **`skills[N].type` received proficiency-level words** ("basic", "intermediate", "advanced", "scrum") instead of `"technical"`/`"soft"`. The CV lists skills with a proficiency level (e.g. "Scrum — Intermediate"); the schema has nowhere to put that information, so the LLM overloads the `type` field with it — the same class of problem `LanguageEntry.proficiency` already solves for languages, just not yet for skills.
2. **`education[N].start_date` was `null`** for two entries. The schema requires a valid date; the source CV doesn't state an explicit start date for at least one education entry (a real, legitimate CV shape — e.g. only a graduation year is given), and the LLM correctly reported "I don't have this" as `null` rather than fabricating a date, which the current schema then rejects outright.

Per the "Extraction Failure Handling" spec, a flat-call schema failure after retry fails the whole job with no partial persistence — so this real CV could not be onboarded at all.

## What Changes

- `SkillEntry` (Python) gains an optional `proficiency: Optional[str]` field, mirroring `LanguageEntry.proficiency`. The extraction prompt is strengthened to state explicitly that `type` is only ever `"technical"` or `"soft"` (a category, never a mastery level) and that a stated proficiency level goes in the new `proficiency` field instead. The worked example gains a skill with a `proficiency` value so the LLM sees the correct shape.
- `EducationEntry.start_date` becomes `Optional[date]` (matching `end_date`'s existing optionality). The prompt's existing "omit end_date if not stated" guidance is extended to also cover start_date.
- **Data model**: `Skill.proficiency String? @db.VarChar(50)` added (matching `Language.proficiency` exactly); `Education.startDate` becomes nullable (`DateTime?`). New migration.
- **Node persistence** (`cvExtractionProcessor.ts`): `EducationEntry.start_date` becomes `string | null`; `startDate: e.start_date ? new Date(e.start_date) : null` guards the conversion. `SkillEntry` gains `proficiency?: string | null`, persisted the same way `LanguageEntry.proficiency` already is.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `cv-extraction`: the "Extracted Field Coverage" and "Persistence and Embedding of Extraction Results" requirements gain scenarios for skill proficiency capture and education entries with no stated start date.

## Impact

- **Schema**: `backend/prisma/schema.prisma` (`Skill.proficiency` added, `Education.startDate` nullable) + new migration.
- **Python**: `backend/agents/cv_analyst/schemas.py`, `extraction_service.py` (prompt + worked example).
- **Node**: `backend/api/queue/cvExtractionProcessor.ts` (types + persistence).
- **Docs**: `docs/data-model.md` (`Skill`, `Education` entries).
- No changes to `WorkExperienceEntry`/`FlatWorkExperienceEntry.start_date` — those stay required; this issue was only observed for education dates and skill types.

## Why

A different real CV (uploaded during a follow-up manual test session, the day after `cv-extraction-schema-gaps` shipped) failed extraction job 25 with 10 Pydantic validation errors, all in `work_experience`:

1. **`work_experience[N].start_date` was `null`** for 8 of the CV's job entries — the same "not stated" pattern already fixed for `Education.start_date`, just not yet extended to work experience (explicitly called out as a non-goal in the previous change, on the assumption it hadn't been observed there — it now has).
2. **`work_experience[N].end_date` received a duration phrase instead of a date**: `"6 meses"` and `"6 años"` (Spanish for "6 months"/"6 years"). This CV states how *long* the candidate worked somewhere rather than an actual end date for some entries. The existing partial-date normalizer's fuzzy `dateutil` fallback can't parse a bare duration as a date, and (correctly) leaves the original string in place — which then fails Pydantic's `date` validation instead of being recognized as "not a real date, treat as unknown."

## What Changes

- `WorkExperienceEntry.start_date` and `FlatWorkExperienceEntry.start_date` become `Optional[date]` (mirrors `EducationEntry.start_date`'s existing optionality from the previous change).
- `schemas.py`'s date normalization gains a duration-phrase detector: a bare quantity + duration unit (`"6 months"`, `"2 years"`, `"6 meses"`, `"3 años"`, `"40 hours"`, `"40 horas"`, etc., English or Spanish) normalizes to `None` — "we know how long, not when" is treated the same as "not stated," not as a parse failure to reject. Applies to any date field using the shared normalizer (work experience/education dates, and — found one layer deeper during this same verification pass, a certification stating its course length ("40 horas") in `issue_date` — certification issue dates too). This does **not** loosen the existing safety net for genuinely nonsensical date strings (e.g. `"not a date"` still correctly fails validation) — only recognized duration phrases are affected.
- `schemas.py`'s existing Spanish-month-abbreviation translation (`_SPANISH_MONTH_ALIASES`) gains the full month names ("enero", "febrero", ... "diciembre") alongside the abbreviations it already handled — found via the same CV writing "mayo, 2012" instead of an abbreviation.
- `extraction_service.py`'s two `date_range` string-builders (used in the per-job detail prompt and its retry prompt) are guarded against a `None` start_date instead of calling `.isoformat()` on it directly.
- The extraction prompt's existing "omit start_date if unstated" guidance (added for education) is extended to explicitly cover work experience too, and gains guidance that a stated *duration* (not an actual end date) should also result in omitting `end_date`.
- **Data model**: `WorkExperience.startDate` becomes nullable (`DateTime?`), matching `Education.startDate`. New migration.
- **Node persistence**: `WorkExperienceEntry.start_date` becomes `string | null`; the `Date` conversion is guarded the same way `EducationEntry.start_date` already is.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `cv-extraction`: the "Extracted Field Coverage" and "Persistence and Embedding of Extraction Results" requirements gain scenarios for work experience entries with no stated start date, and for a stated duration (rather than an end date) normalizing to "unknown" instead of failing.

## Impact

- **Schema**: `backend/prisma/schema.prisma` (`WorkExperience.startDate` nullable) + new migration.
- **Python**: `backend/agents/cv_analyst/schemas.py` (duration normalizer, optional start_date), `extraction_service.py` (prompt + two `date_range` guards).
- **Node**: `backend/api/queue/cvExtractionProcessor.ts` (types + persistence).
- **Docs**: `docs/data-model.md` (`WorkExperience` entry).
- No changes to `Education` (already fixed) or to `end_date`'s existing optionality anywhere — only `start_date` gains optionality here, and only for work experience.

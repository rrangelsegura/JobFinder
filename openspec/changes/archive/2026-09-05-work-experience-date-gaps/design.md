## Context

`cv-extraction-schema-gaps` (shipped the previous day) explicitly listed "touching `WorkExperienceEntry`/`FlatWorkExperienceEntry.start_date`" as a non-goal, reasoning it "stays required" since the problem had only been observed for `Education`. A follow-up manual test with a different real CV immediately falsified that assumption: 8 work experience entries with no start date, plus a new failure mode not seen before — `end_date` receiving a duration phrase ("6 meses", "6 años") instead of an actual date.

The exact Pydantic errors:
```
work_experience.0.start_date ... work_experience.7.start_date
  Input should be a valid date [type=date_type, input_value=None, ...]
work_experience.0.end_date
  Input should be a valid date or datetime, input is too short [input_value='6 meses', ...]
work_experience.1.end_date
  Input should be a valid date or datetime, input is too short [input_value='6 años', ...]
```

## Goals / Non-Goals

**Goals:**
- Extend `start_date` optionality from `Education` to `WorkExperience`, closing the gap the previous change's own non-goal turned out to be wrong about.
- Recognize duration phrases ("N months/years/meses/años", etc.) as "not an actual date" and normalize to `None`, rather than failing the job.

**Non-Goals:**
- A general-purpose duration-to-date-range calculator (e.g. inferring `end_date` from `start_date + "6 months"`) — out of scope; "unknown" is an acceptable, honest outcome, same philosophy as every other optional field here.
- Touching `Certification.issue_date` — not observed as affected by either failure mode.
- Loosening the safety net for genuinely invalid date strings (`test_start_date_still_rejects_genuinely_invalid_values` must keep passing unchanged) — only recognized duration phrases get the new leniency.

## Decisions

**1. `WorkExperienceEntry.start_date` → `Optional[date]`, same pattern as `Education`.**
No new design here — directly extends the previous change's already-established precedent to the sibling entity it turned out to also apply to.

**2. Duration-phrase detection as a small fixed pattern, not a general NLP/date-math solution.**
Mirrors `ONGOING_END_DATE_TOKENS`'s existing approach (a small, explicit vocabulary/pattern for known non-date phrases) rather than attempting to compute an actual end date from a duration — that would require knowing which end of the range is "anchored" (the start? today? something else?) and silently produce a *fabricated* date, which is exactly what this codebase has consistently avoided (see `end_date: None` for "ongoing," `start_date: None` for "not stated"). "We know the duration but not the actual date" becomes `None` — an honest, consistent "we don't know," not a guess.

**3. Duration detection runs before the fuzzy `dateutil` fallback, not after.**
`_normalize_partial_date`'s `dateutil_parser.parse(..., default=datetime(1900, 1, 1))` fallback is permissive enough that it might partially misparse a duration phrase (e.g. extracting the leading digit as a day-of-month) rather than cleanly failing — better to intercept and resolve known duration phrases to `None` *before* that fallback ever sees them, rather than rely on it failing predictably.

**4. Guard `.isoformat()` call sites rather than making `date_range` itself optional-aware at every caller.**
`_build_work_experience_detail_prompt` and its retry-prompt counterpart both build a human-readable `date_range` string for the LLM prompt. With `start_date` now possibly `None`, `start_date.isoformat()` would raise `AttributeError`. Rendering it as a plain word ("unknown") keeps the prompt readable and doesn't require restructuring either function's signature.

## Risks / Trade-offs

- **[Risk] The duration-phrase pattern might not cover every language/phrasing a CV could use** (e.g. "half a year", "1.5 years"). → Accepted: same class of trade-off as `ONGOING_END_DATE_TOKENS`'s fixed vocabulary already accepts — covers what's been observed via real CVs, extended again if a new real CV surfaces a new phrasing, rather than trying to anticipate every possible variant upfront.
- **[Risk] Making `WorkExperience.startDate` nullable could make a future "sort by start date" or "years of experience" feature harder.** → Accepted: the alternative (hard-failing extraction whenever a real CV doesn't state one) is strictly worse today; that feature doesn't exist yet, and can special-case a `NULL` start date if/when it does.

## Migration Plan

1. `schemas.py`: add duration-phrase normalizer, wire into `_normalize_date_value`; `WorkExperienceEntry`/`FlatWorkExperienceEntry.start_date` → `Optional[date] = None`.
2. `extraction_service.py`: guard both `date_range` builders; extend prompt guidance to work experience start dates and to duration-vs-end_date.
3. `schema.prisma`: `WorkExperience.startDate` → `DateTime?`; generate migration.
4. `cvExtractionProcessor.ts`: type + persistence guard, mirroring `EducationEntry.start_date`'s existing handling.
5. `docs/data-model.md`: update `WorkExperience` entry.
6. Rollback: revert the above + drop the migration — job 25 never persisted (all-or-nothing guarantee), so no data exists under the old assumption to migrate away from.

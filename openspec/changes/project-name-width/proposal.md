## Why

A migration (`backend/prisma/migrations/20260804164900_project_name_width/migration.sql`) widening `projects.name` from `VarChar(150)` to `VarChar(300)` was authored and left staged, uncommitted, on a branch with **no OpenSpec proposal, no design rationale, and no updated `schema.prisma`** — a direct violation of this project's own "no code without a validated specification" rule (`docs/base-standards.md`), flagged during a repo audit and picked up now to close it out properly. `schema.prisma` still declares `VarChar(150)`, disagreeing with the pending migration. No commit message or spec explains why 150 was insufficient; by analogy to the same class of fix already made once (`WorkExperience.description` was widened from `VarChar(200)` to unbounded TEXT in `cv-upload-hardening` after a real CV crashed persistence on the old limit), the most likely cause is the same: a real CV's project name exceeded 150 characters and either failed persistence or truncated data.

## What Changes

- Update `backend/prisma/schema.prisma`'s `Project.name` field from `@db.VarChar(150)` to `@db.VarChar(300)`, matching the already-authored, previously-uncommitted migration.
- Update `docs/data-model.md`'s `Project.name` documentation (currently states "max 150 characters") to match.
- No application code changes — `extraction_service.py`'s Pydantic schema and the persistence path in `cvExtractionProcessor.ts` already write whatever string the LLM extracts; only the database column's stated capacity is out of sync.

## Epic

Not part of the Continuous Integration epic — this is an independent, small data-model correction, resuming work that was paused (stashed) during that epic.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `cv-extraction`: the "Persistence and Embedding of Extraction Results" requirement gains a scenario covering long project names persisting without truncation up to the new 300-character limit.

## Impact

- **Schema**: `backend/prisma/schema.prisma` (one field), plus the already-existing migration file (no new migration needed — it was already authored, just never applied to the schema/history in sync).
- **Docs**: `docs/data-model.md`.
- **No API or UI changes.**

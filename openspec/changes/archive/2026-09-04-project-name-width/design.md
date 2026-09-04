## Context

`backend/prisma/migrations/20260804164900_project_name_width/migration.sql` already exists in the repo, staged/uncommitted, containing exactly:
```sql
-- AlterTable
ALTER TABLE "projects" ALTER COLUMN "name" SET DATA TYPE VARCHAR(300);
```
`schema.prisma` was never updated to match — it still declares `name String @db.VarChar(150)` for `Project`. This is the same category of gap the project has hit before: `WorkExperience.description` needed widening from `VarChar(200)` to `TEXT` after a real CV crashed persistence (`cv-upload-hardening`, `20260731011544_widen_work_experience_description`) — but that widen went through the full propose → migrate → schema-update cycle. This one didn't.

## Goals / Non-Goals

**Goals:**
- Bring `schema.prisma` back in sync with the already-authored migration (schema says 300, matching the SQL).
- Keep `docs/data-model.md` accurate.
- Close the SDD process gap this represents, per this project's own rules.

**Non-Goals:**
- Investigating or fixing any other schema/documentation drift beyond `Project.name` — out of scope for this change.
- Widening `Project.name` further than 300, or making it unbounded (`TEXT`) like `WorkExperience.description` was — 300 is what the existing migration already specifies; changing that number would mean writing a *different* migration, not finishing this one.

## Decisions

**1. Reuse the existing migration file as-is; do not generate a new one.**
Its SQL (`VARCHAR(150)` → `VARCHAR(300)`) is exactly what's needed and hasn't been applied to any database yet (it was never committed, so no environment has run it). Regenerating via `prisma migrate dev` after updating `schema.prisma` would produce an equivalent or near-identical migration; reusing the original avoids a redundant/renamed migration file for a change that was already correctly authored, just not finished.

**2. 300 characters, not unbounded TEXT.**
Unlike `WorkExperience.description` (free-form prose, correctly unbounded), a project *name* is a short label — 300 characters is generous for that purpose without opening the door to someone storing a paragraph in a `name` field. This matches the number already chosen in the pending migration; this change is about finishing that decision, not re-deciding it.

## Risks / Trade-offs

- **[Risk] The original reason 150 was insufficient is inferred, not confirmed** (no commit message, spec, or fixture documents an actual overflow). → Mitigation: the fix is safe regardless of the exact original trigger — widening a `VARCHAR` column is a non-destructive, backward-compatible schema change with no data loss risk, so acting on the reasonable inference is low-risk even if the precise root cause is uncertain.

## Migration Plan

1. Update `schema.prisma`'s `Project.name` to `@db.VarChar(300)`.
2. Update `docs/data-model.md`.
3. Run `npx prisma generate` and confirm `npm run build`/`npm test` still pass (this widening shouldn't affect any test, since no test asserts the 150-char limit — confirmed by grep in tasks.md).
4. Rollback: revert the `schema.prisma` field and drop the migration file — no data has been written under the new width yet in any environment.

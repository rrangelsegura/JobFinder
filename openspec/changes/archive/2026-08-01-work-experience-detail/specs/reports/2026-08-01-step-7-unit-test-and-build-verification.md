# Step 7: Unit Test and Build Verification

**Change:** `work-experience-detail`
**Date:** 2026-08-01

## Commands Run

```bash
cd backend && npx jest
docker exec infra-backend-agent-1 python -m pytest -q
cd frontend && npm run build && npm run lint
```

## Results

- Backend Jest: **53 passed** (10 suites) — includes 9 new tests in `cvExtractionProcessor.test.ts` (responsibilities/projects/achievements/stack persistence, atomicity, replace-semantics delete) and 2 new tests in `reprocessExistingResumes.test.ts`.
- Python pytest (backend-agent, run inside the live container): **49 passed** — includes 4 new tests in `test_schemas.py` (`ProjectEntry`/`WorkExperienceEntry.responsibilities`/`.projects`) and 2 new tests in `test_extraction_service.py` (worked-example depth for the new nested structure).
- Frontend `npm run build`: zero TypeScript errors — confirms the frontend still compiles despite `CvExtractionResult`-adjacent backend interface changes (the frontend never imports these types directly, but this was worth confirming rather than assuming).
- Frontend `npm run lint`: 0 errors, 1 pre-existing warning (Shadcn's own generated `button.tsx`, unrelated — same one noted in `cv-upload-hardening`'s report).

## Notable Implementation Detail

`cvExtractionProcessor.ts` moved from Prisma's sequential-array `$transaction(operations)` form to the interactive `$transaction(async (tx) => {...})` form (per design.md Decision 3), since `WorkExperience`/`Project` rows need their generated `id` available to create their own children. `cvExtractionProcessor.test.ts` was rewritten accordingly — its mock for `prisma.$transaction` now invokes the callback with `prisma` itself as `tx`, so existing assertions against `prisma.<model>.<method>` kept working with minimal changes; `workExperience`/`project` mocks were switched from `createMany` to `create` with fake-id-returning implementations so nested creates could be asserted.

No other test suites were affected by the transaction-form migration.

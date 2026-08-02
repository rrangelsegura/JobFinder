# Step 6: Unit Test and Build Verification

**Change:** `cv-extraction-multi-call`
**Date:** 2026-08-01

## Commands Run

```bash
docker exec infra-backend-agent-1 python -m pytest -q
cd backend && npx jest
cd frontend && npm run build && npm run lint
```

## Results

- Python pytest (backend-agent, full suite, run inside the live container): **56 passed** — includes 8 new tests in `test_schemas.py`/`test_extraction_service.py` covering `WorkExperienceDetailResult`, the reverted flat worked example, the new detail-call prompt/example, `_extract_work_experience_detail`'s own retry-once behavior, full orchestration (flat + N detail calls merged), and partial-failure absorption with logging.
- Backend Jest: **53 passed** (10 suites) — unchanged from before this change. Confirms `router.py`'s equivalent TypeScript layer (`cvExtractionProcessor.ts`) and everything downstream of it needed zero modifications, exactly as design.md predicted — the new multi-call orchestration is fully contained inside `extraction_service.py`.
- Frontend `npm run build`: zero TypeScript errors.
- Frontend `npm run lint`: 0 errors, 1 pre-existing warning (Shadcn's own generated `button.tsx`, unrelated).

## Notable Implementation Detail

Most of the *existing* tests in `test_extraction_service.py` needed no changes at all: their fixtures all use an empty `work_experience: []`, so the new orchestration's per-job loop simply does nothing extra for them — they still exercise exactly one flat call, identical to before this change. Only the two tests that referenced the old combined `_EXAMPLE_RESULT`'s work-experience-detail depth needed rewriting (they now target `_FLAT_EXAMPLE_RESULT`, asserting the *absence* of responsibilities/projects, and a new `_WORK_EXPERIENCE_DETAIL_EXAMPLE`, asserting depth there instead).

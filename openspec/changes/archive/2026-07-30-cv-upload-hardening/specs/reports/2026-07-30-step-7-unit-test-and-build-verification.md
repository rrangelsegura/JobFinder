# Step 7: Unit Test and Build Verification

**Change:** `cv-upload-hardening`
**Date:** 2026-07-30

## Commands Run

```bash
cd backend && npx jest
docker exec infra-backend-agent-1 python -m pytest -q
cd frontend && npm run test && npm run build && npm run lint
```

## Results

- Backend Jest: **45 passed** (9 suites) — includes new `emailService.test.ts` additions (`sendExtractionFailureEmail`) and new `handleExtractionFailure.test.ts`.
- Python pytest (backend-agent, run inside the live container): **30 passed** — includes 4 new tests in `test_extraction_service.py` (length-invariant prompt instruction, explicit `num_ctx`, retry prompt no longer repeating the full previous output, capped/deduped error summary).
- Frontend Vitest: **42 passed** (14 files) — all pre-existing tests still pass unchanged after adopting Shadcn `Input`/`Label`/`Card` across `LoginPage`, `RegisterPage`, `CvUploadForm`, `WorkspaceLayout`, `UploadPage`, confirming the Shadcn adoption is a styling change, not a behavior change.
- `npm run build`: zero TypeScript errors.
- `npm run lint`: 0 errors (1 pre-existing warning on Shadcn's own generated `button.tsx`, unrelated).

## Coverage Review (Group 6)

- Confirmed `CardTitle` (Shadcn) renders a `<div>`, not a semantic heading — a real regression risk since `App.test.tsx`, `unauthenticated-redirect.spec.ts`, and the new `auth-flow.spec.ts` all query `getByRole("heading", ...)`. Fixed by keeping real `<h1>` elements inside `CardHeader` on `LoginPage`, `RegisterPage`, and `UploadPage` instead of using `CardTitle` for the page's main heading.
- No other tests needed adjustment — the Shadcn adoption only touched markup/classNames, not any queried text, label association, or button semantics (`Label`'s Radix primitive still renders a native `<label for=...>`, so `getByLabelText` continues to resolve correctly).

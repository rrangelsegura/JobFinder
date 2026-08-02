# Step 8: Unit Test and Build Verification

**Change:** `candidate-email-verification`
**Date:** 2026-08-02

## Commands Run

```bash
cd backend && npx jest
cd frontend && npx vitest run && npm run build && npm run lint
```

## Results

- Backend Jest: **71 passed** (11 suites) — includes new tests in `emailVerificationToken.test.ts` (6), `emailService.test.ts` (+1), `auth.test.ts` (+13: registration change, verify-email, resend-verification, login/session `emailVerified`), `requireAuth.test.ts` (+2), `rateLimiter.test.ts` (unchanged, new function tested indirectly via `auth.test.ts`).
- Frontend Vitest: **49 passed** (15 files) — includes new `VerifyEmailPage.test.tsx` (6) and `ProtectedRoute.test.tsx` (+1 for the unverified-redirect case).
- `npm run build`: zero TypeScript errors.
- `npm run lint`: 0 errors, 1 pre-existing warning (Shadcn's own generated `button.tsx`, unrelated).

## Notable Finding During Review (Step 7)

`uploads.test.ts` broke — its `../prisma` mock didn't include `candidate.findUnique`, which `requireAuth` now calls to check `emailVerifiedAt`. Fixed by adding it and having the test's `authenticateAs` helper default to a verified candidate (these tests are about upload behavior, not verification).

`auth-flow.spec.ts` (Playwright E2E) would also break for real — it registers then immediately expects workspace access, which the new gate blocks. Fixed for real, not stubbed: added `ioredis` as a frontend devDependency so the test can fetch the real verification token from the same Redis key (`email-verify-candidate:<id>`) the backend itself writes, then calls the real `POST /auth/verify-email` before logging in. Deliberately did not attempt to parse MailDev's own email content — that's tangential to what this test proves (the auth gate, not email deliverability, which `emailService.test.ts` already covers at the unit level).

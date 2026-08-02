# Step 14: Frontend Unit Test and Build Verification

**Change:** `candidate-authentication`
**Date:** 2026-07-30

## Commands Run

```bash
cd frontend
npm run test    # vitest run
npm run build   # tsc -b && vite build
npm run lint     # eslint .
```

## Results

```
Test Files  13 passed (13)
     Tests  38 passed (38)
```

New/changed test files for this change:
- `src/features/auth/useAuth.test.tsx` — register/login/logout mutations, backend error-message pass-through
- `src/features/auth/RegisterPage.test.tsx` — submit, duplicate-email error
- `src/features/auth/LoginPage.test.tsx` — submit, generic error, navigates to workspace on success
- `src/features/workspace/WorkspaceLayout.test.tsx` — added: logout button clears session and redirects to `/login`
- `src/features/auth/useSession.test.ts` — updated: swap point now defaults to `live`, `VITE_AUTH_MODE=mock` selects the fixture
- `src/App.test.tsx` — updated: stubs `useSession()` directly instead of depending on the (now-flipped) default adapter
- `src/features/upload/CvUploadForm.test.tsx`, `useCvUpload.ts` — updated: no longer sends `candidateId` (server derives it from session)

`npm run build`: zero TypeScript errors. `npm run lint`: 0 errors (1 pre-existing warning on Shadcn's own generated `button.tsx`, unrelated to this change).

## Coverage Review (Group 13)

Reviewed all tests against `specs/candidate-authentication/spec.md` and the `cv-upload` delta spec. One real gap found and fixed: `CvUploadForm`/`useCvUpload` still constructed and sent a client-supplied `candidateId` in the upload request, even though the backend (this change, Group 6) now ignores it entirely and derives it from the session. Removed the field and the `useSession()` coupling it required in `CvUploadForm` — confirmed via a RED test first (rendering `CvUploadForm` without a `QueryClientProvider` failed because it no longer needs `useSession()` at all, which is exactly the coupling being removed).

All other requirements (registration, login, generic login failure, session persistence, logout, password security, route protection, rate limiting) are backend-only concerns already covered by `backend/api`'s Jest suite (see `specs/reports/2026-07-30-step-9-unit-test-and-db-verification.md`) or already covered by `candidate-workspace`'s existing frontend tests (`ProtectedRoute`, `WorkspaceLayout` nav) that remain valid and unchanged.

# Step 6: Unit Test and Build Verification

**Change:** `candidate-workspace`
**Date:** 2026-07-30
**Scope:** `frontend/` (Groups 1-5 of `tasks.md`)

## Commands Run

```bash
cd frontend
npm run test    # vitest run
npm run build   # tsc -b && vite build
npm run lint    # eslint .
```

## Results

### `npm run test`

```
Test Files  10 passed (10)
     Tests  27 passed (27)
```

Test files:
- `src/App.test.tsx` — integration smoke test: mock-authenticated candidate reaches `/workspace/upload`
- `src/features/auth/useSession.mock.test.ts` — mock adapter resolves to the `US-003`-documented session fixture shape
- `src/features/auth/useSession.test.ts` — swap point resolves to mock by default, live when `VITE_AUTH_MODE=live`
- `src/features/workspace/WorkspaceLayout.test.tsx` — all 4 nav sections render; Upload is a live link; Chat/Analysis Results/Action Plan are disabled and don't navigate
- `src/routes/ProtectedRoute.test.tsx` — unauthenticated → redirect to `/login`; authenticated → renders protected content
- `src/features/upload/CvUploadForm.test.tsx` — client-side PDF-only validation; submit calls the upload mutation with `{file, candidateId}`
- `src/features/upload/useCvExtractionStatus.test.tsx` — polls every 2500ms while `processing`; stops polling on both `completed` and `failed` (fake timers, asserting no further calls after the terminal state)
- `src/features/upload/UploadStatusIndicator.test.tsx` — distinct rendering per status; failure uses `role="alert"`, processing/completed use `role="status"`
- `src/features/upload/errorMessages.test.ts` — every documented backend-error substring maps to its friendly message; unrecognized errors fall back to the generic message
- `src/features/upload/UploadPage.test.tsx` — end-to-end (mocked HTTP) flow: upload → processing indicator → completed, and upload → failed → non-technical message (raw backend string never rendered)

### `npm run build`

```
tsc -b && vite build
✓ built in 311ms
```

Zero TypeScript errors. Production bundle emitted to `frontend/dist/`.

### `npm run lint`

```
1 problem (0 errors, 1 warning)
```

The single warning is `react-refresh/only-export-components` on `src/components/ui/button.tsx`, which is Shadcn/UI's own generated file (exports both the `Button` component and `buttonVariants`). Not project code, not an error, left as-is.

## Coverage Review (Group 5)

Reviewed all tests from Groups 2-4 against `specs/candidate-workspace-shell/spec.md` and `specs/cv-upload-ui/spec.md`. One gap found and closed: `useCvExtractionStatus`'s original test only exercised polling-stop on the `completed` transition; added a second case asserting polling also stops on `failed` (design.md Decision 2 requires both). All other requirement scenarios have direct or integration-level coverage; see task 5.1/5.2 in `tasks.md`.

## Known Gaps (not covered by this step, tracked in Group 7)

- No real end-to-end run against a live backend yet (Playwright, Group 7).
- `useSession.live.ts` has no dedicated unit test — intentional, per `tasks.md` 2.5 and design.md, since it isn't genuinely exercisable until `US-003` ships real `/auth/*` endpoints.

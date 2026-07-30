## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [x] 0.1 Create feature branch `feature/candidate-workspace-frontend` from main
- [x] 0.2 Verify branch creation and current branch status

## 1. Frontend Project Scaffold

- [x] 1.1 Initialize `frontend/` with Vite + React 18 + TypeScript (strict) per `docs/frontend-standards.md`
- [x] 1.2 Configure Tailwind CSS + Shadcn/UI
- [x] 1.3 Add `react-router-dom`, `zustand`, `@tanstack/react-query`, `axios`
- [x] 1.4 Configure ESLint + Prettier per `docs/frontend-standards.md`'s Git & Quality standard
- [x] 1.5 Confirm `npm run dev` and `npm run build` both succeed with a placeholder page

## 2. Auth Adapter (Mock + Live, per Design Decision 1)

- [x] 2.1 Define the `useSession()` hook interface (`{ candidateId, email, isAuthenticated, isLoading }`) and the Zustand `authStore` shape
- [x] 2.2 Implement `useSession.mock.ts`, fixture matching `US-003`'s documented `GET /auth/session` response exactly
- [x] 2.3 Implement `useSession.live.ts` (real call to `GET /auth/session`) — written now, not yet exercisable end-to-end until `US-003` ships
- [x] 2.4 Wire the single swap point selecting which implementation is active
- [x] 2.5 Write Vitest unit tests for the mock adapter and the swap point

## 3. Workspace Shell (TDD)

- [x] 3.1 Write Vitest + React Testing Library tests for `WorkspaceLayout`: renders all 4 nav items; Upload is a live link; Chat/Analysis Results/Action Plan are visibly disabled, not plain broken links
- [x] 3.2 Implement `WorkspaceLayout` and nav components (including a `DisabledNavItem` per design.md's Risk mitigation — visually distinct, not just non-functional)
- [x] 3.3 Write tests for `ProtectedRoute`: authenticated session → renders children; no session → redirects to `/login`
- [x] 3.4 Implement `ProtectedRoute` using `useSession()`
- [x] 3.5 Wire `router.tsx`: `/login` (stub page, real implementation is `US-003`'s), protected workspace routes
- [x] 3.6 Confirm all shell tests pass

## 4. CV Upload Flow (TDD)

- [x] 4.1 Write tests for `CvUploadForm`: file selection, client-side PDF-only check, submit triggers the upload call
- [x] 4.2 Implement `CvUploadForm` + `useCvUpload` (TanStack Query mutation calling `POST /uploads/cv`)
- [x] 4.3 Write tests for `useCvExtractionStatus`: polls while `processing`, stops polling on `completed`/`failed` (per design.md Decision 2 — use fake timers to verify polling stops, not just that it starts)
- [x] 4.4 Implement `useCvExtractionStatus`
- [x] 4.5 Write tests for `UploadStatusIndicator`: distinct rendering for `processing` / `completed` / `failed`
- [x] 4.6 Implement `UploadStatusIndicator`
- [x] 4.7 Write tests for the error-message mapping table (design.md Decision 3): each documented backend-error substring maps to its friendly message; an unrecognized error falls back to the generic message
- [x] 4.8 Implement `errorMessages.ts`
- [x] 4.9 Wire `UploadPage` combining the form, polling hook, status indicator, and error mapping
- [x] 4.10 Confirm all upload-flow tests pass

## 5. Review and Update Existing Unit Tests (MANDATORY)

- [x] 5.1 Review all tests from groups 2-4 against `specs/candidate-workspace-shell/spec.md` and `specs/cv-upload-ui/spec.md` scenarios for coverage gaps
- [x] 5.2 Add or adjust tests for any scenario found uncovered

## 6. Run Unit Tests and Build Verification (MANDATORY)

- [x] 6.1 Run the full Vitest suite
- [x] 6.2 Run `npm run build`; confirm zero TypeScript errors (per `docs/frontend-standards.md`'s Git & Quality standard)
- [x] 6.3 Create report `specs/reports/YYYY-MM-DD-step-6-unit-test-and-build-verification.md`

## 7. Manual / E2E Verification (MANDATORY - AGENT MUST EXECUTE)

- [x] 7.1 Start the frontend dev server and the existing backend stack (`infra/docker-compose.yml` from `parse-candidate-cv`)
- [x] 7.2 Playwright E2E, using the **mock** auth adapter: navigate to the workspace → upload a real PDF → observe the processing state → observe the completed state — this is the exact scenario `docs/frontend-standards.md`'s Testing Standards names as the reference E2E test
- [x] 7.3 Playwright E2E: unauthenticated visitor is redirected to `/login`
- [x] 7.4 Document results (commands run, scenarios covered, pass/fail) in the report from 6.3 or a dedicated report file
- [x] 7.5 **Explicitly record as blocked, not silently skipped**: full-stack E2E with a real login against real `/auth/*` endpoints cannot be executed until `US-003` ships as an implemented change — this is a known, documented gap in this change's verification, not a task marked done by proxy via the mock

## 8. Documentation (MANDATORY)

- [x] 8.1 Add `frontend/README.md` with setup/run instructions
- [x] 8.2 Confirm `docs/frontend-standards.md` still accurately describes what was built, or note deviations

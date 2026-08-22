## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [x] 0.1 Create feature branch `feature/ci-pipeline-foundation` from `main`
- [x] 0.2 Verify branch creation and current branch status

## 1. Self-Hosted Runner Provisioning

- [x] 1.1 Runner host confirmed: the project owner's own development machine (see design.md) — no separate provisioning needed, install directly on it
- [x] 1.2 Verified already installed on the runner host: Node v22.18.0, Python 3.11.9, Tesseract-OCR (`C:\Program Files\Tesseract-OCR\tesseract.exe`), Poppler (`pdftoppm` via winget), Ollama (`%LOCALAPPDATA%\Programs\Ollama\ollama.exe`) — nothing to install
- [ ] 1.3 Register the machine as a GitHub Actions self-hosted runner for this repository (Settings → Actions → Runners → New self-hosted runner)
- [ ] 1.4 Confirm the runner shows "Idle" in GitHub before proceeding

## 2. CI Workflow Authoring

- [ ] 2.1 Create `.github/workflows/ci.yml` triggered on `pull_request` (targeting `main`) and `push` (to `main`)
- [ ] 2.2 Add `backend-node` job: checkout, setup Node 20, `npm ci`, `npm run build`, `npm test` — `working-directory: backend`
- [ ] 2.3 Add `backend-python` job: checkout, setup Python 3.11, `pip install -r requirements.txt`, `pytest` — `working-directory: backend`
- [ ] 2.4 Add `frontend` job: checkout, setup Node 20, `npm ci`, `npm run lint`, `npm run format:check`, `npm run build`, `npm test` — `working-directory: frontend`
- [ ] 2.5 Set `runs-on` to the self-hosted runner label for all three jobs
- [ ] 2.6 Confirm no job starts or depends on Postgres, Redis, ChromaDB, MailDev, or a real Ollama call

## 3. Review and Update Existing Unit Tests (MANDATORY)

- [ ] 3.1 Confirm no changes are needed to the 32 existing test files — this change only adds automation around them
- [ ] 3.2 Re-grep the suite at implementation time to confirm `ioredis` and `_call_ollama` are still mocked everywhere, so the "no live services" decision in design.md still holds

## 4. Run Unit Tests and Verify Pipeline (MANDATORY)

- [ ] 4.1 Run the full suite locally once before pushing (`npm test` in `backend/`, `pytest` in `backend/`, `npm test` in `frontend/`) and record baseline pass/fail counts
- [ ] 4.2 Push the feature branch and open a PR against `main` to trigger the new workflow for the first time
- [ ] 4.3 Confirm all three jobs (`backend-node`, `backend-python`, `frontend`) appear on the PR and complete
- [ ] 4.4 Confirm the pipeline's pass/fail counts match the local baseline from 4.1
- [ ] 4.5 On a scratch commit, intentionally break one test (trivial failing assertion), confirm the corresponding job turns red, then revert the scratch commit — proves the pipeline detects failures, not just that it runs
- [ ] 4.6 Create verification report at `openspec/changes/ci-pipeline-foundation/specs/ci-pipeline/reports/YYYY-MM-DD-step-4-unit-test-and-pipeline-verification.md` documenting commands run, job results, and the red/green proof from 4.5

## 5. Manual Endpoint Testing with curl — NOT APPLICABLE

- [ ] 5.1 Marked N/A per `docs/openspec-tasks-mandatory-steps.md` traceability requirement: this change adds no new HTTP endpoint, only CI automation around existing code

## 6. E2E Testing with Playwright MCP — NOT APPLICABLE

- [ ] 6.1 Marked N/A: this change introduces no new user-facing UI workflow; running Playwright inside CI is explicitly deferred to `ci-e2e-pipeline` (epic change 3)

## 7. Update Technical Documentation (MANDATORY)

- [ ] 7.1 Update `docs/development_guide.md` to replace the "CI/CD pipeline is defined" placeholder with a description of the real workflow and how to read its results
- [ ] 7.2 Add a short "Continuous Integration" note to the root `README.md` describing the pipeline and its current non-blocking status

## 8. Close Out

- [ ] 8.1 Merge the PR for `feature/ci-pipeline-foundation` into `main` once step 4 passes
- [ ] 8.2 Propose `openspec archive ci-pipeline-foundation` per the project's standard change lifecycle

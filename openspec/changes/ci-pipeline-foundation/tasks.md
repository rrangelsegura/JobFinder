## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [x] 0.1 Create feature branch `feature/ci-pipeline-foundation` from `main`
- [x] 0.2 Verify branch creation and current branch status

## 1. Self-Hosted Runner Provisioning — SUPERSEDED, REVERSED

- [x] 1.1–1.4 Originally: registered self-hosted runner `LAP1RS-jobfinder` on the project owner's own PC, ran it interactively, confirmed online. **Reversed after the owner raised a legitimate local-security concern** about running a persistent, network-reachable runner on their personal machine — especially once the repo was confirmed public. Also, nearly every bug hit while getting this runner green (CRLF/LF via `core.autocrlf`, `python` on PATH resolving to an unrelated tool's venv, `actions/setup-python` failing outright, needing an elevated terminal for the service, and the accidental global-Python-environment mutation logged under 4.3) was specific to "Windows + self-hosted on a personal dev machine," not to CI itself.
- [x] 1.5 **Decision: switch to GitHub-hosted runners instead of self-hosted.** The repo is public, so GitHub-hosted minutes are free and unlimited. The entire test suite is already mocked (no real Ollama/Redis dependency), so hosted runners lose nothing today. Cleanup performed: killed the `Runner.Listener.exe` process, ran `config.cmd remove` (deregistered from GitHub), deleted `~/actions-runner-jobfinder` entirely. Confirmed via `gh api repos/rrangelsegura/JobFinder/actions/runners` → `[]` (no runners registered). The owner's PC has no leftover service, process, or registration.

## 2. CI Workflow Authoring

- [x] 2.1 Create `.github/workflows/ci.yml` triggered on `pull_request` (targeting `main`) and `push` (to `main`)
- [x] 2.2 Add `backend-node` job: checkout, setup Node 20, `npm ci`, `npm run build`, `npm test` — `working-directory: backend`
- [x] 2.3 Add `backend-python` job: checkout, setup Python 3.11, `pip install -r requirements.txt`, `pytest` — `working-directory: backend`
- [x] 2.4 Add `frontend` job: checkout, setup Node 20, `npm ci`, `npm run lint`, `npm run format:check`, `npm run build`, `npm test` — `working-directory: frontend`
- [x] 2.5 Set `runs-on: ubuntu-latest` for all three jobs (changed from `[self-hosted]`, see section 1); restored `actions/setup-python@v5` since the Windows-runner-specific failure no longer applies on `ubuntu-latest`, and dropped the `PYTHON_EXE` absolute-path workaround (no longer needed)
- [x] 2.6 Confirmed: no `services:` block in any job, no dependency on Postgres/Redis/ChromaDB/MailDev/real Ollama

## 3. Review and Update Existing Unit Tests (MANDATORY)

- [x] 3.1 Confirmed: no changes needed to the 32 existing test files — this change only adds automation around them
- [x] 3.2 Re-grepped at implementation time: `jest.mock("ioredis", ...)` still present in `rateLimiter.test.ts`/`session.test.ts`/`emailVerificationToken.test.ts`; `monkeypatch.setattr(extraction_service, "_call_ollama", ...)` still present (11 occurrences) in `test_extraction_service.py` — "no live services" decision still holds

## 4. Run Unit Tests and Verify Pipeline (MANDATORY)

- [x] 4.1 Baseline recorded locally: `npm test` backend/ = 11 suites / 71 tests passed (after `npx prisma generate`, which resolved a stale-client compile failure — a known project issue, no code change); `pytest` backend/ = 59 passed; `npm test` frontend/ = 15 files / 49 tests passed; `npm run build` (backend and frontend) both clean; `npm run lint` frontend = 0 errors (1 pre-existing warning); `npm run format:check` frontend now passes after a separate mechanical `prettier --write` fix (12 files, no logic change — see `style(frontend): apply prettier formatting` commit)
- [x] 4.2 Pushed the feature branch, opened [PR #6](https://github.com/rrangelsegura/JobFinder/pull/6) — triggered the workflow for the first time
- [x] 4.3 All three jobs appeared and completed on the first run — **all three failed**, each for a real, distinct configuration gap (not app code):
  - `frontend`: `format:check` failed on 60 files on the runner despite passing locally. Root cause: `core.autocrlf=true` (global, this machine) converts LF→CRLF on any fresh checkout; my local working copy still had the raw LF bytes from `prettier --write` and was never re-checked-out, masking the issue. **Fix:** added root `.gitattributes` (`* text=auto eol=lf`) so checkouts are always LF regardless of the machine's autocrlf setting. Verified the committed blobs are already LF (`git show HEAD:... | file -`).
  - `backend-node`: `tsc` build failed (`TS7006: Parameter 'tx' implicitly has an 'any' type`) because the workflow never ran `prisma generate` — `npm ci` alone doesn't generate the Prisma Client, so its types fell back to a generic/untyped shape. **Fix:** added `npx prisma generate` before `npm run build` in the `backend-node` job.
  - `backend-python`: `actions/setup-python@v5` failed trying to run the Python 3.11 installer on this runner. **Fix:** dropped `actions/setup-python`; the job now uses the real Python 3.11.9 already on this machine directly by absolute path (`$env:PYTHON_EXE`), since the ambient `python` on PATH resolves to an unrelated tool's venv without pip.
  - **Incident during investigation:** while testing the Python fix, `pip install -r requirements.txt` was run once directly against the machine's real global Python (not yet isolated), which downgraded/changed 6 shared packages (python-dateutil, pydantic-core, uvicorn, pydantic, fastapi, chromadb) and reported conflicts with two unrelated tools (`pandas-profiling`, `scrapegraph-py`) already installed there. Flagged to the project owner immediately; owner chose to review/restore that environment themselves rather than have it touched further. **Corrected approach:** the workflow now always creates a fresh, isolated venv (`.venv-ci`) inside the runner's own checkout and never installs into global site-packages.
- [ ] 4.4 Re-verify: push the three fixes above and confirm the pipeline's pass/fail counts match the local baseline from 4.1
- [ ] 4.5 On a scratch commit, intentionally break one test (trivial failing assertion), confirm the corresponding job turns red, then revert the scratch commit — proves the pipeline detects failures, not just that it runs
- [ ] 4.6 Create verification report at `openspec/changes/ci-pipeline-foundation/specs/ci-pipeline/reports/YYYY-MM-DD-step-4-unit-test-and-pipeline-verification.md` documenting commands run, job results, and the red/green proof from 4.5

## 5. Manual Endpoint Testing with curl — NOT APPLICABLE

- [x] 5.1 Marked N/A per `docs/openspec-tasks-mandatory-steps.md` traceability requirement: this change adds no new HTTP endpoint, only CI automation around existing code

## 6. E2E Testing with Playwright MCP — NOT APPLICABLE

- [x] 6.1 Marked N/A: this change introduces no new user-facing UI workflow; running Playwright inside CI is explicitly deferred to `ci-e2e-pipeline` (epic change 3)

## 7. Update Technical Documentation (MANDATORY)

- [x] 7.1 Updated `docs/development_guide.md`, replacing the placeholder with the real workflow description
- [x] 7.2 Added a "Continuous Integration" section to the root `README.md` with a job table and non-blocking status note

## 8. Close Out

- [ ] 8.1 Merge the PR for `feature/ci-pipeline-foundation` into `main` once step 4 passes
- [ ] 8.2 Propose `openspec archive ci-pipeline-foundation` per the project's standard change lifecycle

# Step 4 Report - Unit Tests and CI Pipeline Verification

- Date: 2026-08-24
- Change: ci-pipeline-foundation
- Agent: Claude (Sonnet 5)

## Commands Executed

Local baseline (before any push):
- `npx prisma generate && npm test` (backend/) — resolved a pre-existing stale-Prisma-client compile failure, no code change
- `.venv/Scripts/python.exe -m pytest -q` (backend/)
- `npm test`, `npm run lint`, `npm run format:check`, `npm run build` (frontend/) — `format:check` initially failed on 35 pre-existing unformatted files, fixed via `prettier --write` (separate mechanical commit)

CI runs (GitHub Actions, `.github/workflows/ci.yml`, PR #6):
1. Run `32655972519` (self-hosted runner, first attempt) — **all 3 jobs failed**, each for a real config gap (CRLF/LF, missing `prisma generate`, `actions/setup-python` incompatible with the runner). See tasks.md §4.3 for full root-cause detail per job.
2. Run `32657022073` — workflow failed to parse (`&` at the start of a YAML scalar is reserved for anchors); fixed by quoting the line.
3. Run `32657089099` — `backend-node` and `backend-python` fixed and passing; `frontend` still failing on the stale `_work` checkout (pre-existing CRLF files not re-normalized by an incremental checkout). Root-caused by comparing a fresh `git clone` (LF, correct) against the runner's actual `_work` files on disk (CRLF, stale) — same machine, direct filesystem access confirmed this.
4. Decision: abandon self-hosted runner entirely (public repo + Windows-specific bugs + an incident where testing a fix mutated the owner's global Python packages) in favor of GitHub-hosted `ubuntu-latest`. Runner deregistered (`config.cmd remove`) and deleted from the machine; confirmed via `gh api .../actions/runners` → `[]`.
5. Run `32760583997` (first `ubuntu-latest` run) — **all 3 jobs passed** on the first attempt.
6. Run `32760725642` (deliberate red/green proof) — a scratch commit added `backend/api/__ci-scratch__.test.ts` with an always-failing assertion. `backend-node` correctly turned **failure**; `backend-python` and `frontend` correctly stayed **success** (the broken test only existed in `backend/api`).
7. Run `32760810414` (after reverting the scratch commit) — **all 3 jobs passed** again.

## Unit Test Results

Local baseline and CI (run `32760583997` / `32760810414`) match exactly:

| Suite | Local | CI |
|---|---|---|
| Jest (`backend/`) | 11 suites / 71 tests passed | 11 suites / 71 tests passed |
| Pytest (`backend/`) | 59 passed | 59 passed |
| Vitest (`frontend/`) | 15 files / 49 tests passed | 15 files / 49 tests passed |
| Frontend lint/format/build | clean (1 pre-existing warning) | clean |
| Backend build (tsc) | clean | clean |

No flaky behavior observed across 7 CI runs.

## Database State Verification

Not applicable — this change adds no database-touching code; the workflow starts no database, and no test in the suite performs a real database write (all mocked, per tasks.md §3.2).

## Outcome

- Step 4 status: **PASS**
- Blocking issues: none
- Notable deviations from the original plan, both resolved and documented in `design.md`/`tasks.md`: the runner architecture changed from self-hosted to GitHub-hosted mid-implementation, three real CI configuration bugs were found and fixed, and one incident (accidental global Python environment mutation during self-hosted testing) was disclosed to and resolved with the project owner.

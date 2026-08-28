# ci-pipeline Specification

## Purpose
TBD - created by archiving change ci-pipeline-foundation. Update Purpose after archive.
## Requirements
### Requirement: Automated pipeline runs on pull requests and pushes to main
The system SHALL run an automated build-and-test pipeline via GitHub Actions on every pull request targeting `main` and on every push to `main`.

#### Scenario: Pull request opened against main
- **WHEN** a pull request is opened or updated targeting the `main` branch
- **THEN** the CI workflow runs all three jobs (`backend-node`, `backend-python`, `frontend`) and reports their status on the pull request

#### Scenario: Direct push to main
- **WHEN** a commit is pushed directly to `main`
- **THEN** the CI workflow runs all three jobs and reports their status on the commit

### Requirement: Backend Node job builds and tests the API gateway
The system SHALL run, in a job scoped to the `backend/` directory, dependency installation, a TypeScript build, and the full Jest suite.

#### Scenario: Node backend job succeeds
- **WHEN** the `backend-node` job runs against a commit where `npm run build` and `npm test` both succeed
- **THEN** the job reports a passing status

#### Scenario: Node backend job fails on a broken test
- **WHEN** any of the 10 Jest test files fails
- **THEN** the `backend-node` job reports a failing status and the failure is visible in the workflow run's log

### Requirement: Backend Python job tests the agentic core
The system SHALL run, in a job scoped to the `backend/` directory, Python dependency installation from `requirements.txt` and the full pytest suite, on a runner with the system dependencies pytest needs available (`tesseract-ocr`, `poppler-utils`).

#### Scenario: Python backend job succeeds
- **WHEN** the `backend-python` job runs against a commit where `pytest` exits with all 5 test files passing
- **THEN** the job reports a passing status

#### Scenario: Python backend job fails on a broken test
- **WHEN** any pytest test fails or errors
- **THEN** the `backend-python` job reports a failing status and the failure is visible in the workflow run's log

### Requirement: Frontend job lints, checks formatting, builds, and tests the SPA
The system SHALL run, in a job scoped to the `frontend/` directory, dependency installation, ESLint, Prettier format-check, the TypeScript+Vite build, and the full Vitest suite.

#### Scenario: Frontend job succeeds
- **WHEN** the `frontend` job runs against a commit where `npm run lint`, `npm run format:check`, `npm run build`, and `npm test` all succeed
- **THEN** the job reports a passing status

#### Scenario: Frontend job fails on a lint violation
- **WHEN** `npm run lint` reports any error-level violation
- **THEN** the `frontend` job reports a failing status without running the remaining steps' results as passing

### Requirement: Pipeline runs on a self-hosted runner without starting live service dependencies
The system SHALL execute all three jobs on a self-hosted GitHub Actions runner, and SHALL NOT start Postgres, Redis, ChromaDB, MailDev, or a real Ollama call as part of any job in this pipeline.

#### Scenario: No live services required
- **WHEN** the CI workflow runs
- **THEN** none of its jobs depend on `infra/docker-compose.yml` or any running service — every test that would otherwise need Redis or the LLM relies on the mocks already present in the test suite (`jest.mock("ioredis", ...)`, `monkeypatch.setattr(extraction_service, "_call_ollama", ...)`)

### Requirement: Pipeline status is informative and non-blocking
The system SHALL report job status on commits and pull requests, and SHALL NOT be configured as a required status check that blocks merging in this change.

#### Scenario: Pull request can be merged despite a failing CI job
- **WHEN** a pull request has one or more failing CI jobs
- **THEN** GitHub still allows the pull request to be merged, and the failure is visible only as an informative status indicator


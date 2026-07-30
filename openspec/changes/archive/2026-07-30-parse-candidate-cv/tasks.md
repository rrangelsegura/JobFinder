## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [x] 0.1 Create feature branch `feature/parse-candidate-cv-backend` from main
- [x] 0.2 Verify branch creation and current branch status

## 1. Documentation: Update Data Model (Spec Before Code)

- [x] 1.1 Add `Skill`, `Language`, `Certification` entities to `docs/data-model.md` per `design.md` Decision 1
- [x] 1.2 Update the Entity Relationship Diagram section to include the new entities

## 2. Infra: Docker Compose for the Full Stack

- [x] 2.1 Create `infra/docker-compose.yml` with services: Postgres, Redis, ChromaDB (vector store), the Node.js API (`backend/`), and the Python agent service — per `docs/backend-standards.md`'s "entire stack must be containerized" requirement (Ollama runs on the host, referenced via its API URL, not containerized, since models are already pulled locally)
- [x] 2.2 Add `.env.example` files for `backend/` and the Python agent service with the variables named in `docs/development_guide.md` (DB, Ollama URL) plus Redis/Chroma connection vars
- [x] 2.3 Bring the stack up (`docker compose -f infra/docker-compose.yml up -d postgres redis chroma`) and confirm each service is reachable

## 3. Backend: Prisma Schema

- [x] 3.1 Add `Skill`, `Language`, `Certification` models to `backend/prisma/schema.prisma` with `candidate` (N:1) relations
- [x] 3.2 Confirm/add `Resume` model fields (`filePath`, `fileType`, `uploadDate`, `candidateId`)
- [x] 3.3 Generate and run the Prisma migration against the containerized Postgres

## 4. Backend: Upload Endpoint (TDD)

- [x] 4.1 Write Jest tests for `POST /uploads/cv` validation: valid PDF accepted, non-PDF rejected (400), oversized file rejected (400), corrupted PDF rejected with clear error
- [x] 4.2 Implement multipart upload handling + validation in `backend/api/routes/uploads.ts`
- [x] 4.3 Write Jest tests for `Resume` persistence, job enqueue, and the `202` response shape
- [x] 4.4 Implement `Resume` persistence and job enqueue (Redis/BullMQ) in `backend/api/queue/`
- [x] 4.5 Confirm all upload endpoint tests pass

## 5. Backend: Status Polling Endpoint (TDD)

- [x] 5.1 Write Jest tests for `GET /uploads/cv/{jobId}`: `processing`, `completed` (with candidate data), `failed` (with error), unknown id (404)
- [x] 5.2 Implement the status route, including the standard response envelope (`status`, `data`, `agent_trace_id`, `model_used`)
- [x] 5.3 Confirm all status endpoint tests pass

## 6. Python Agent: OCR Extraction (TDD)

- [x] 6.1 Write Pytest tests for the OCR wrapper: primary success, primary failure + fallback success, both providers fail
- [x] 6.2 Implement PyTesseract as the primary OCR provider in `backend/knowledge_base/ocr/`
- [x] 6.3 Implement Amazon Textract as the fallback OCR provider
- [x] 6.4 Confirm all OCR tests pass

## 7. Python Agent: Structured LLM Extraction (TDD)

- [x] 7.1 Define the extraction Pydantic schema in `backend/agents/cv_analyst/schemas.py` (personal info, education, work experience, skills, languages, certifications)
- [x] 7.2 Write Pytest tests for: schema validation success, validation failure triggering one retry, failure after retry
- [x] 7.3 Implement the `CV Analyst` agent's LLM prompting, schema validation, and retry-once logic in `backend/agents/cv_analyst/`
- [x] 7.4 Confirm all extraction tests pass, including the retry-after-invalid-schema case required by the Definition of Done

## 8. Python Agent: Embedding + REST Response Contract (per Design Decision 0)

- [x] 8.1 Write Pytest tests for chunking + section-tagged embedding into the vector store (`resumes_embeddings`)
- [x] 8.2 Implement the embedding pipeline in `backend/knowledge_base/embeddings/`, called from within the extraction endpoint
- [x] 8.3 Write Pytest tests for the FastAPI extraction endpoint's REST contract: success response shape (structured candidate JSON), and error response shape on unrecoverable OCR/LLM failure — the endpoint does NOT touch Postgres
- [x] 8.4 Implement the FastAPI extraction endpoint wiring OCR → LLM extraction → embedding → response
- [x] 8.5 Confirm all embedding and endpoint-contract tests pass

## 9. Node Worker: Call Python Agent and Persist Results (per Design Decision 0)

- [x] 9.1 Write Jest tests for the BullMQ worker: on a successful Python REST response, `Candidate`/`Education`/`WorkExperience`/`Skill`/`Language`/`Certification` are persisted via Prisma and the job is marked `completed`
- [x] 9.2 Write Jest tests for the failure path: on an OCR/LLM failure response from Python, the job is marked `failed` with the returned reason and no partial data is persisted
- [x] 9.3 Implement the BullMQ worker in `backend/api/queue/` that calls the Python extraction endpoint via REST and persists the result via Prisma (or marks the job failed)
- [x] 9.4 Confirm all worker tests pass

## 10. Backend: Review and Update Existing Unit Tests (MANDATORY)

- [x] 10.1 Review all unit tests written in groups 4-9 against the scenarios in `specs/*/spec.md` for coverage gaps
- [x] 10.2 Add or adjust tests for any scenario found uncovered during review

## 11. Backend: Run Unit Tests and Verify Database State (MANDATORY)

- [x] 11.1 Capture pre-test database baseline for `Candidate`/`Education`/`WorkExperience`/`Skill`/`Language`/`Certification`/`Resume`
- [x] 11.2 Run targeted unit tests for the changed modules (Jest + Pytest)
- [x] 11.3 Run the full required unit test suite
- [x] 11.4 Verify post-test database state and restore it if any unintended mutation remains
- [x] 11.5 Create report `specs/parse-candidate-cv/reports/YYYY-MM-DD-step-11-unit-test-and-db-verification.md`
- [x] 11.6 Mark this step complete only after tests pass and the report exists

## 12. Backend: Manual Endpoint Testing with curl (MANDATORY - AGENT MUST EXECUTE)

- [x] 12.1 Ensure the Node.js API, the Python agent service, Postgres, Redis, and the vector store are all running (via `infra/docker-compose.yml`)
- [x] 12.2 `curl` a valid PDF to `POST /uploads/cv`, verify `202` with `resumeId`/`jobId`, then clean up the created records
- [x] 12.3 `curl` a non-PDF file to `POST /uploads/cv`, verify `400`
- [x] 12.4 `curl` an oversized file to `POST /uploads/cv`, verify `400`
- [x] 12.5 `curl` `GET /uploads/cv/{jobId}` for `processing`/`completed`/`failed` jobs, verify response envelope and status codes
- [x] 12.6 `curl` `GET /uploads/cv/{jobId}` with an unknown id, verify `404`
- [x] 12.7 Document all curl commands and responses in the report from step 11.5 (or a dedicated report file)
- [x] 12.8 Verify database state matches the pre-test baseline after cleanup

## 13. Frontend: E2E Testing with Playwright MCP (NOT APPLICABLE)

- [x] 13.1 Confirm no `frontend/` files are in scope for this change (per `proposal.md`'s Impact section — only Node API, Python agent, infra, and docs) and document this justification in the report; skip Playwright E2E execution accordingly

## 14. Documentation: Update API Spec (MANDATORY)

- [x] 14.1 Update `docs/api-spec.yml`: change `POST /uploads/cv` from synchronous `201` to the async `202` contract, add `GET /uploads/cv/{jobId}`
- [x] 14.2 Cross-check that the `docs/data-model.md` changes from group 1 match the final Prisma schema exactly

## 15. Agent Eval (Definition of Done)

- [x] 15.1 Assemble a golden dataset of 2-3 known CVs with expected extraction output
- [x] 15.2 Run extraction against the golden dataset and verify output consistency
- [x] 15.3 Document eval results in `specs/parse-candidate-cv/reports/`

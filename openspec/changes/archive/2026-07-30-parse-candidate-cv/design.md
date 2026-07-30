## Context

This change implements US-001 (Parse Candidate CV) inside the existing Hybrid Multi-Agent Architecture: `Frontend → Node.js API Gateway → Python Agentic Core (FastAPI) → Local LLM (Ollama) → Tools/Knowledge Base → Response`, with async processing (job queue + polling/WebSocket) as the platform's standard pattern for long-running agent work (`docs/backend-standards.md`).

The relational data model (`docs/data-model.md`) currently has `Candidate`, `Education`, `WorkExperience`, and `Resume`, but no entities for skills, languages, or certifications — yet the acceptance criteria require extracting all three when present. This gap was flagged as a blocking decision in the source user story and has now been resolved (see Decisions).

This is a greenfield implementation: no `backend/` code exists yet, and `docs/api-spec.yml`'s current `/uploads/cv` entry is a placeholder (synchronous `201`, no job concept), not a live contract with real consumers.

## Goals / Non-Goals

**Goals:**
- Deliver the three capabilities from the proposal (`cv-upload`, `cv-extraction-status`, `cv-extraction`) end to end.
- Extend the relational model with normalized `Skill`, `Language`, `Certification` entities, consistent with the existing `Education`/`WorkExperience` pattern.
- Keep extraction reliable and debuggable: schema-validated LLM output, one retry on validation failure, `agent_trace_id`/`model_used` on every response.

**Non-Goals:**
- CV quality analysis, CV rewriting, job matching, candidate scoring, career recommendations (explicitly out of scope per the proposal).
- Skill taxonomy/canonicalization (e.g. merging "JS" and "JavaScript" into one canonical skill) — skills are stored as extracted, free-text `name`.
- Choosing/provisioning the job queue infrastructure itself — this design assumes Redis/BullMQ per `docs/backend-standards.md`'s existing async-pattern standard, not introducing it as a new architectural decision.

## Decisions

### 0. Node/Python responsibility boundary: Python returns data, Node persists it

**Decision**: per `docs/backend-standards.md`, Prisma (PostgreSQL) is exclusively the Node.js layer's ORM — the Python layer has no relational database client, only RAG (ChromaDB/Pinecone) and OCR (PyTesseract/Amazon Textract) capabilities. Node and Python communicate via REST.

Concretely: the Node.js BullMQ worker (in `backend/api/queue/`) dequeues the extraction job and makes a REST call to the Python `CV Analyst` agent's extraction endpoint. That endpoint runs OCR → LLM extraction → Pydantic validation (with the one retry) → embeds the resume text into the vector store (Python's own RAG responsibility, no Node involvement needed) → and returns the structured, validated candidate JSON as the REST response, or an error payload on unrecoverable failure. The Node worker then persists `Candidate`/`Education`/`WorkExperience`/`Skill`/`Language`/`Certification` via Prisma on success, or marks the job `failed` with the returned reason on failure. Python never opens a Postgres connection.

This corrects an earlier draft of this design, which had the Python agent persisting relational data directly — that contradicted the documented ORM boundary.

### 1. Skills/Languages/Certifications: dedicated relational entities

**Decision**: add `Skill`, `Language`, `Certification` as normalized 1:N entities off `Candidate`, following the same shape as `Education`/`WorkExperience`. The resume text is still chunked and embedded into `resumes_embeddings` regardless (unchanged from the proposal) — the relational entities are additive, for structured access.

**New entities** (to be added to `docs/data-model.md` and `backend/prisma/schema.prisma`):

- **Skill**: `id` (PK), `name` (string, max 100), `type` (`technical` | `soft`), `candidateId` (FK). Relationship: `candidate` (N:1).
- **Language**: `id` (PK), `name` (string, max 50), `proficiency` (string, optional, free text — e.g. "native", "fluent"; not enum-constrained in this iteration), `candidateId` (FK). Relationship: `candidate` (N:1).
- **Certification**: `id` (PK), `name` (string, max 150), `issuer` (string, optional, max 150), `issueDate` (date, optional), `candidateId` (FK). Relationship: `candidate` (N:1).

No max-count constraint (unlike `Education`'s 3-record cap) — not specified by the source story, not invented here.

**Alternatives considered:**
- *JSONB field on `Candidate`*: fastest to ship, but `matching_engine` and `gap_analysis_engine` (per `openspec/config.yaml`'s defined agent roles) need to reliably compare a candidate's skills against a job description's required skills — exact/structured queries against a JSONB blob are more fragile than querying a normalized table, and this system explicitly has agents whose job is that comparison.
- *Vector store only*: rejected for the same reason — semantic retrieval is good for "find candidates similar to X" but weak for "does this candidate have skill=Python AND skill=SQL," which gap analysis needs. The embedding still happens either way (see `cv-extraction` spec), so this option would have meant losing structured access with no offsetting simplicity, since the embedding pipeline work is unavoidable regardless.

### 2. OCR: PyTesseract primary, Amazon Textract fallback

Per the source story. PyTesseract is free/self-hosted and sufficient for typical text-based CV PDFs; Textract is reserved as a fallback for harder cases (scanned/image-heavy PDFs) rather than the default, to avoid unconditional per-upload cloud OCR cost.

### 3. LLM structured output: Pydantic validation, one retry

Matches the platform's hallucination-guardrail standard (`docs/backend-standards.md`): local models must not return free-form JSON. On validation failure, retry once with a refined prompt; on second failure, mark the job `failed` rather than persisting unvalidated data.

### 4. Embedding: chunk + section-tag into `resumes_embeddings`

Unchanged from the proposal — resume text is chunked and embedded regardless of the skills/languages/certifications storage decision, tagged by section (`skills`, `experience`, etc.) per `docs/data-model.md` §4 (Vector Domain), to support future RAG/matching use.

## Risks / Trade-offs

- **[Risk]** Scanned/image-based CVs may produce poor OCR text even with the Textract fallback → **[Mitigation]** OCR failure on both providers marks the job `failed` with a clear reason (per `cv-extraction` spec) instead of silently producing garbage extraction output.
- **[Risk]** LLM extraction is inherently non-deterministic; retries add latency → **[Mitigation]** cap at one retry (per hallucination-guardrail standard); log `agent_trace_id` and `model_used` on every attempt to support debugging and the golden-dataset agent eval called out in the proposal's Definition of Done.
- **[Risk]** Adding three new entities (vs. a single JSONB field) is more schema/migration work for what's labeled an MVP story → **[Mitigation]** kept each entity minimal (name + 0-2 optional fields), no taxonomy/normalization logic in this iteration — the extra cost is schema surface area, not extraction logic complexity.
- **[Risk]** No infrastructure is provisioned yet in this repo (no Postgres, Redis, or vector DB running; `agentic`/Python service not scaffolded) — confirmed against `docs/backend-standards.md`, which requires the **entire stack** (Node, Python, Postgres, VectorDB, Ollama) containerized via Docker, a larger footprint than a minimal Postgres+Redis setup → **[Mitigation]** this change includes an `infra/docker-compose.yml` covering all five services as part of implementation, not assumed pre-existing.

## Migration Plan

Greenfield feature — no production data to migrate. Sequenced rollout:

1. Update `docs/data-model.md` with `Skill`, `Language`, `Certification` entities (spec before code).
2. Add corresponding Prisma models + migration (`backend/prisma/schema.prisma`).
3. Implement Node.js upload/validation/queue-producer route and the status-polling route.
4. Implement the Python `CV Analyst` agent (OCR + LLM extraction + Pydantic schema + embedding) — returns structured data via REST, does not persist relationally (see Decision 0).
5. Implement the Node.js BullMQ worker that calls the Python agent and persists the returned data via Prisma (or marks the job failed).
6. Update `docs/api-spec.yml` to the async contract and the new endpoint.
7. Wire and test end to end (unit, integration, agent eval per the proposal's Definition of Done).

No rollback complexity beyond standard feature-branch revert — nothing in production depends on the current `docs/api-spec.yml` placeholder yet.

## Open Questions

- Exact `Language.proficiency` representation (free text vs. a constrained enum/scale) is left as free text for this iteration; revisit if a future story needs to filter/sort candidates by proficiency level.

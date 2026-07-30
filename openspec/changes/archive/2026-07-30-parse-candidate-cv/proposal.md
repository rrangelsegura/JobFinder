## Why

Candidates currently have no way to get their CV data into the system except manual entry, which is slow and creates friction at the exact moment (onboarding) where a job seeker decides whether to keep using the platform. Automatically extracting personal info, education, and work experience from an uploaded PDF removes that friction and produces the structured candidate profile every downstream agent (matching, gap analysis, action plan, CV tailoring) depends on.

## What Changes

- New multipart PDF upload endpoint that validates the file, persists a `Resume` record, and enqueues an async extraction job instead of processing inline.
- New polling endpoint to retrieve extraction job status and, once completed, the structured candidate data.
- New `CV Analyst` agent (Python/FastAPI) that runs OCR on the PDF and prompts a local LLM to produce Pydantic-schema-validated structured output (with one retry on schema-validation failure).
- Extracted data persisted to `Candidate`/`Education`/`WorkExperience`, and the resume text chunked and embedded into the `resumes_embeddings` vector collection for later RAG/matching use.
- `docs/api-spec.yml`'s current `/uploads/cv` placeholder (synchronous `201`, no job concept) is replaced with the async `202` contract described here — there is no running implementation yet, so this is establishing the real contract, not breaking a live consumer.
- Unresolved before implementation: `docs/data-model.md` has no `Skill`, `Language`, or `Certification` entities, but extraction must cover them. This proposal does not resolve that gap — see Open Questions below.

## Capabilities

### New Capabilities

- `cv-upload`: Accepts a `multipart/form-data` PDF upload, validates it (type, size, associated candidate), persists a `Resume` record, enqueues an async extraction job, and returns `202` with a trackable `jobId`.
- `cv-extraction-status`: Exposes job status (`processing | completed | failed`) and, once completed, the structured candidate payload, via polling (and/or WebSocket per the async pattern standard).
- `cv-extraction`: Runs OCR against the uploaded PDF and prompts a local LLM to produce structured, Pydantic-validated candidate data (personal info, education, work experience, skills/languages/certifications when present), embedding the resume text into the vector store as part of the same call; retries once on schema-validation failure before returning an error. Returns the result via REST — relational persistence is owned by the Node.js worker that calls it (Prisma is Node-only per `docs/backend-standards.md`), not by this capability itself.

### Modified Capabilities

_None — no capabilities exist yet in `openspec/specs/`._

## Impact

- **New code**: Node.js API routes + validation + job producer (`backend/api/routes/uploads.ts`, `backend/api/queue/`); Python `CV Analyst` agent, OCR wrapper, extraction schema, embedding pipeline (`backend/agents/cv_analyst/`, `backend/knowledge_base/ocr/`, `backend/knowledge_base/embeddings/`).
- **Schema**: `backend/prisma/schema.prisma` — confirm/extend `Resume`, `Candidate`, `Education`, `WorkExperience`; resolve the skills/languages/certifications storage gap (see Open Questions).
- **Docs**: `docs/api-spec.yml` (async `/uploads/cv` contract + new `GET /uploads/cv/{jobId}`), `docs/data-model.md` (schema gap resolution).
- **New infrastructure dependencies**: Redis/BullMQ (job queue), OCR (PyTesseract, fallback Amazon Textract), local LLM via Ollama (`llama3:8b`/`mistral:7b`), vector store collection `resumes_embeddings` (ChromaDB/Pinecone per `docs/data-model.md` §4). Per `docs/backend-standards.md`, the entire stack (Node, Python, Postgres, VectorDB, Ollama) must be containerized — this change adds `infra/docker-compose.yml` covering all five services, since none are provisioned in the repo yet.
- **Out of scope for this change**: CV quality analysis, CV rewriting, job matching, candidate scoring, career recommendations.

## Open Questions

- **Skills/Languages/Certifications storage**: the relational model has no dedicated entities for these, but acceptance criteria require extracting them. Two options carried over from the source user story (US-001), neither selected yet:
  1. Store as a `JSONB` field (e.g. `Candidate.extractedSkills`) for MVP.
  2. Rely on the vector store (`resumes_embeddings`, `section: "skills"`) for semantic retrieval instead of structured storage.
  This must be decided (and `data-model.md` updated) before `design.md` can specify the extraction schema and persistence logic in full.

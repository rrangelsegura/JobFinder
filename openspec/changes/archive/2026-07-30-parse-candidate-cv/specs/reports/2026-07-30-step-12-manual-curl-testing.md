# Step 12 Report - Manual Endpoint Testing with curl

- Date: 2026-07-30
- Change: parse-candidate-cv
- Agent: Claude (Sonnet 5)

## Environment

Full stack brought up via `docker compose -f infra/docker-compose.yml up -d`: Postgres, Redis, Chroma, `backend-api` (Node), `backend-agent` (Python), plus Ollama running on the host (`llama3:8b`, reachable via `host.docker.internal:11434`). A test `Candidate` (id=1) was inserted directly via `psql` since candidate creation is out of scope for this change (assumed to exist from a prior registration flow).

## Real bugs found and fixed during this step

Manual testing against live infrastructure — not mocks — surfaced three genuine integration bugs that no unit test caught, because every unit test mocked the exact boundary where each bug lived:

1. **Cross-container file path.** The Node API wrote the uploaded PDF to its own container filesystem; the Python agent tried to read the same path from *its* filesystem — two separate containers, two separate filesystems. Fix: added a shared `cv_uploads` Docker volume mounted at `/app/uploads` in both `backend-api` and `backend-agent` (`infra/docker-compose.yml`).
2. **Chroma client/server version mismatch.** `chromadb==0.5.20` (client) against the `chromadb/chroma:latest` image, which resolved to server `1.0.0` — a major-version gap that raised `KeyError: '_type'` inside the client's response parsing. Fix: pinned both sides — client to `chromadb==1.0.0` in `requirements.txt`, server image to `chromadb/chroma:1.0.0` (was `:latest`) in `infra/docker-compose.yml` — plus bumped `fastapi` to `0.115.9` since `chromadb==1.0.0` requires that exact version.
3. **LLM output shape drift.** Two related issues only a real model call would surface: (a) `llama3:8b` copied the literal word "present" from the resume text into `end_date` for an ongoing job, which a plain `Optional[date]` field rejected; (b) it nested `skills` entries as `{"type": {"name": ..., "category": ...}}` instead of the flat `{"name": ..., "type": ...}` shape, apparently confused by "type" appearing both as our field name and as a reserved JSON-Schema keyword in the raw schema dump embedded in the prompt. Fixes: added a `field_validator` normalizing common ongoing-date tokens (`present`/`current`/`ongoing`/`now`/`n/a`/`-`) to `None` on `EducationEntry.end_date` and `WorkExperienceEntry.end_date` (`schemas.py`, +12 new unit tests); replaced the raw JSON-schema dump in both the extraction and retry prompts with a concrete worked JSON example (`extraction_service.py`).

All three fixes were applied, re-verified with the full unit suite (26/26 passing), and then re-tested end to end before being marked done.

## curl Commands and Responses

### 12.2 — Valid PDF upload (after all three fixes)

```
curl -X POST http://localhost:3000/uploads/cv -F "candidateId=1" -F "file=@realistic-cv.pdf;type=application/pdf"
→ 202 {"status":"success","data":{"resumeId":5,"jobId":"5","status":"processing"}, "agent_trace_id":"...", "model_used":null}
```

Polled `GET /uploads/cv/5` until terminal state:

```
→ 200 {"status":"success","data":{"status":"completed","candidate":{
  "personal_info":{"first_name":"Ada","last_name":"Lovelace","email":"ada.lovelace@example.com","phone":"612345678","address":null},
  "education":[{"institution":"University of Cambridge","title":"Mathematics","start_date":"1840-01-01","end_date":"1843-01-01"}],
  "work_experience":[{"company":"Analytical Engines Ltd","position":"Analyst","description":"Wrote the first published algorithm for Charles Babbage's Analytical Engine.","start_date":"1843-01-01","end_date":null}],
  "skills":[{"name":"Python","type":"technical"},{"name":"Mathematics","type":"technical"},{"name":"Communication","type":"soft"}],
  "languages":[{"name":"English","proficiency":"native"},{"name":"French","proficiency":"fluent"}],
  "certifications":[]
}}}
```

Verified independently in Postgres (`SELECT` against `candidates`/`educations`/`work_experiences`/`skills`/`languages`) and in Chroma (`collection.get()` on `resumes_embeddings`, 5 chunks: personal_info, education, experience, skills, languages — no certifications chunk, correctly, since none were present) — both matched the API response exactly.

### 12.3 — Non-PDF file

```
curl -X POST http://localhost:3000/uploads/cv -F "candidateId=1" -F "file=@resume.docx"
→ 400 {"status":"error","data":{"error":"Unsupported file type. Only PDF is accepted."}}
```

### 12.4 — Oversized file (11MB)

```
curl -X POST http://localhost:3000/uploads/cv -F "candidateId=1" -F "file=@oversized-cv.pdf;type=application/pdf"
→ 400 {"status":"error","data":{"error":"File exceeds the maximum allowed size of 10MB."}}
```

### 12.5 — Status polling across states

Covered by the 12.2 flow above (`processing` while queued, `completed` with candidate data on success). The `failed` state was exercised organically three times while diagnosing the bugs above (OCR-path failure once, Chroma failure once, LLM schema failure once) — each returned `200` with `data.status: "failed"` and a `data.error` string, matching `specs/cv-extraction-status/spec.md`.

### 12.6 — Unknown job id

```
curl http://localhost:3000/uploads/cv/does-not-exist-999
→ 404 {"status":"error","data":{"error":"No extraction job found with id does-not-exist-999."},"agent_trace_id":"...","model_used":null}
```

## 12.8 — Database State Verification After Cleanup

- Pre-test baseline (task 11): all 7 tables at 0 rows.
- Post-test, pre-cleanup: `candidates: 1` (the manually-inserted test candidate) + accumulated rows from 5 upload attempts (4 failed, 1 completed) tied to it.
- Cleanup actions: `TRUNCATE ... RESTART IDENTITY CASCADE` on all 7 candidate-domain tables; deleted the `resumes_embeddings` Chroma collection; removed uploaded files from the shared `cv_uploads` volume; deleted all `bull:cv-extraction:*` keys from Redis.
- Post-cleanup verification: all 7 tables back to 0 rows; Chroma collection list is `[]`; no `bull:cv-extraction:*` keys remain in Redis.
- State restored: Yes.

## Outcome

- Step 12 status: PASS
- Blocking issues: none remaining — all three bugs found during this step were fixed and re-verified end to end with real infrastructure before closing it out.

## Step 13 Note - E2E Testing (Not Applicable)

Confirmed no `frontend/` files are in scope for this change — `proposal.md`'s Impact section lists only Node API (`backend/api/`), Python agent (`backend/agents/`, `backend/knowledge_base/`), infra (`infra/`), and docs. No frontend code exists in this repo yet, and this change doesn't add any. Playwright E2E execution is skipped accordingly.

## Step 14.2 Note - data-model.md vs. Prisma schema cross-check

The three entities added in this change (`Skill`, `Language`, `Certification`) match `backend/prisma/schema.prisma` exactly — field names, types, max lengths, optionality, and the `candidateId` relation all line up with `docs/data-model.md` §2.1.

Two **pre-existing** discrepancies found while cross-checking (not introduced by this change, not fixed — flagged for awareness):
1. `Education`'s documented "max 3 records per candidate" rule has no enforcement anywhere (Prisma has no native cardinality constraint for this, and no application-level check was added).
2. `Resume`'s documented "Supported types: PDF and DOCX" is now inaccurate for this feature: `cv-upload/spec.md` and the implemented `POST /uploads/cv` only accept PDF (rejecting DOCX with `400`), matching US-001's literal requirement ("upload my CV in PDF format"). `data-model.md`'s validation note for `Resume` was not updated to reflect this narrower scope.

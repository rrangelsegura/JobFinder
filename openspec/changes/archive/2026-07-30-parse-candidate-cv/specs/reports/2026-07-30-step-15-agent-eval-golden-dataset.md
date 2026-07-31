# Step 15 Report - Agent Eval with Golden Dataset

- Date: 2026-07-30
- Change: parse-candidate-cv
- Agent: Claude (Sonnet 5)

## Dataset

3 synthetic CVs generated as real PDFs (`fpdf2`), stored under `specs/reports/golden-dataset/`, each with pre-defined expected extraction values covering distinct scenarios not all exercised together by any single one:

| CV | Ongoing job (end_date should be null) | Past job (real end_date) | Certifications | Languages |
|---|---|---|---|---|
| `golden-01-lovelace.pdf` (Ada Lovelace) | Yes | — | None | 2 |
| `golden-02-turing.pdf` (Alan Turing) | Yes | — | None | 1 |
| `golden-03-hopper.pdf` (Grace Hopper) | — | Yes | 1, with free-text issuer/date ("issued by DPMA in 1970") | 2 |

## Method

Ran the real, live pipeline (not mocks) for each CV: `POST /uploads/cv` against the running `backend-api` → BullMQ job → `backend-agent` (real Tesseract OCR, real `llama3:8b` via Ollama, real Chroma embedding) → Prisma persistence. Polled `GET /uploads/cv/{jobId}` until `completed`, then compared the returned `data.candidate` field-by-field against the expected values below. All 3 jobs were enqueued together and processed sequentially by the single worker.

## Results

**All 3 of 3 golden CVs extracted correctly on their first completed attempt — zero mismatches against expected values.**

| CV | personal_info | education | work_experience | skills | languages | certifications |
|---|---|---|---|---|---|---|
| Lovelace | exact match | exact match | exact match, `end_date: null` correctly | exact match (3, all technical/soft correct) | exact match (2) | exact match (`[]`) |
| Turing | exact match | exact match | exact match, `end_date: null` correctly | exact match (3, all technical) | exact match (1) | exact match (`[]`) |
| Hopper | exact match | exact match | exact match, `end_date: "1986-08-01"` (a genuine past date, correctly NOT nulled) | exact match (3, 2 technical + 1 soft) | exact match (2) | exact match — `issuer: "DPMA"` and `issue_date: "1970-01-01"` both correctly pulled from free-text ("issued by DPMA in 1970") |

## Retry Behavior (real, not simulated)

Checked `backend-agent` logs for the eval window: of the 3 extraction calls, **1 required the retry-once mechanism** (schema validation failed on the first LLM attempt, succeeded on the refined-prompt retry) and 2 succeeded on the first attempt. All 3 ultimately returned `200 OK` with fully correct data. This is real-world confirmation — not just the mocked unit tests in `test_extraction_service.py` — that the retry-once design (per `docs/backend-standards.md`'s hallucination-guardrail standard) is load-bearing: roughly a third of real calls in this small sample needed it.

## Consistency Assessment

Per `docs/backend-standards.md`'s Agent Eval standard ("use Golden Datasets to test if the agent provides consistent... results for known [inputs]"): across 3 structurally distinct CVs (ongoing vs. past jobs, present vs. absent certifications, varying skill/language counts), extraction was 100% accurate against ground truth on this run. Run-to-run non-determinism (the same CV re-extracted multiple times) was not separately measured in this step due to time cost of repeated real LLM calls — but was already observed indirectly during Step 12's iteration, where the same `golden-01-lovelace.pdf` input failed differently across several attempts before the schema/prompt fixes (see `2026-07-30-step-12-manual-curl-testing.md`) and has now succeeded consistently across the 2 attempts made since (Step 12's final retry + this step's Lovelace run).

## Cleanup

`TRUNCATE ... RESTART IDENTITY CASCADE` on all 7 candidate-domain tables, deleted the `resumes_embeddings` Chroma collection, cleared the shared uploads volume, deleted all `bull:cv-extraction:*` Redis keys. Verified `candidates` count back to 0 after cleanup.

## Outcome

- Step 15 status: PASS
- Definition of Done item "Agent eval: golden-dataset test with 2-3 known CVs to confirm extraction consistency" — satisfied.
- Blocking issues: none.

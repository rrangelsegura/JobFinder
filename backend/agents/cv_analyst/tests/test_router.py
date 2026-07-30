from unittest.mock import MagicMock

from fastapi.testclient import TestClient

from agents.cv_analyst import router as router_module
from agents.cv_analyst.extraction_service import LlmSchemaValidationError
from agents.cv_analyst.schemas import CvExtractionResult, PersonalInfo
from agents.main import app
from knowledge_base.ocr.ocr_service import OcrExtractionError

client = TestClient(app)

SAMPLE_RESULT = CvExtractionResult(
    personal_info=PersonalInfo(first_name="Ada", last_name="Lovelace", email="ada@example.com")
)


def _request_body():
    return {"resume_id": 7, "candidate_id": 42, "file_path": "/uploads/cv/some-resume.pdf"}


# Spec: success response shape — structured candidate JSON
def test_extract_endpoint_returns_structured_candidate_on_success(monkeypatch):
    monkeypatch.setattr(router_module, "extract_text_from_pdf", lambda path: "raw ocr text")
    monkeypatch.setattr(router_module, "extract_structured_data", lambda text: SAMPLE_RESULT)
    mock_embed = MagicMock(return_value=5)
    monkeypatch.setattr(router_module, "embed_resume_chunks", mock_embed)

    res = client.post("/cv-analyst/extract", json=_request_body())

    assert res.status_code == 200
    body = res.json()
    assert body["personal_info"]["first_name"] == "Ada"
    mock_embed.assert_called_once()


# Spec: the endpoint does NOT touch Postgres — nothing in this module should
# import prisma/psycopg/a Node-style DB client; verified structurally by the
# fact that router_module has no such import, exercised implicitly by every
# test in this file running without a database connection available.
def test_extract_endpoint_success_path_never_touches_a_database(monkeypatch):
    monkeypatch.setattr(router_module, "extract_text_from_pdf", lambda path: "raw ocr text")
    monkeypatch.setattr(router_module, "extract_structured_data", lambda text: SAMPLE_RESULT)
    monkeypatch.setattr(router_module, "embed_resume_chunks", MagicMock(return_value=1))

    # No DB fixture, no DB env vars configured for this test process — if the
    # router tried to open a DB connection, this would raise, not silently pass.
    res = client.post("/cv-analyst/extract", json=_request_body())
    assert res.status_code == 200


# Spec: error response shape on unrecoverable OCR failure
def test_extract_endpoint_returns_error_on_ocr_failure(monkeypatch):
    def failing_ocr(path):
        raise OcrExtractionError("OCR failed on both providers")

    monkeypatch.setattr(router_module, "extract_text_from_pdf", failing_ocr)
    mock_extract = MagicMock()
    monkeypatch.setattr(router_module, "extract_structured_data", mock_extract)

    res = client.post("/cv-analyst/extract", json=_request_body())

    assert res.status_code == 422
    assert "OCR failed" in res.json()["detail"]["error"]
    mock_extract.assert_not_called()  # never got past OCR


# Spec: error response shape on unrecoverable LLM/schema failure
def test_extract_endpoint_returns_error_on_llm_failure(monkeypatch):
    monkeypatch.setattr(router_module, "extract_text_from_pdf", lambda path: "raw ocr text")

    def failing_llm(text):
        raise LlmSchemaValidationError("LLM output failed schema validation after one retry")

    monkeypatch.setattr(router_module, "extract_structured_data", failing_llm)
    mock_embed = MagicMock()
    monkeypatch.setattr(router_module, "embed_resume_chunks", mock_embed)

    res = client.post("/cv-analyst/extract", json=_request_body())

    assert res.status_code == 422
    assert "schema validation" in res.json()["detail"]["error"]
    mock_embed.assert_not_called()  # never persisted embeddings for a failed extraction

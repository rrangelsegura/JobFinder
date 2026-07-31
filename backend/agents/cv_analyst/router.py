"""REST contract for the CV Analyst agent.

Per design.md Decision 0: this endpoint owns OCR -> LLM extraction -> embedding
and returns the result over REST. It never touches Postgres — relational
persistence is the Node.js worker's job (Prisma is Node-only).
"""

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from knowledge_base.ocr.ocr_service import OcrExtractionError, extract_text_from_pdf
from knowledge_base.embeddings.embedding_service import embed_resume_chunks

from .extraction_service import LlmSchemaValidationError, extract_structured_data
from .schemas import CvExtractionResult

logger = logging.getLogger(__name__)

router = APIRouter()


class ExtractionRequest(BaseModel):
    resume_id: int
    candidate_id: int
    file_path: str


@router.post("/cv-analyst/extract", response_model=CvExtractionResult)
def extract_cv(request: ExtractionRequest) -> CvExtractionResult:
    try:
        resume_text = extract_text_from_pdf(request.file_path)
    except OcrExtractionError as error:
        logger.error("OCR failed for resume %s: %s", request.resume_id, error)
        raise HTTPException(status_code=422, detail={"error": str(error), "stage": "ocr"})

    try:
        result = extract_structured_data(resume_text)
    except LlmSchemaValidationError as error:
        logger.error("LLM extraction failed for resume %s: %s", request.resume_id, error)
        raise HTTPException(status_code=422, detail={"error": str(error), "stage": "llm"})

    embed_resume_chunks(
        candidate_id=request.candidate_id,
        resume_id=request.resume_id,
        extraction=result,
    )

    return result

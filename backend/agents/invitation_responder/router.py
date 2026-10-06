"""REST contract for the invitation responder agent.

Same boundary as cv_analyst (design.md Decision 0 of the original change):
this module owns LLM logic and returns validated data over REST. It never
touches Postgres — persistence is the Node.js worker's job. Extraction and
drafting are separate endpoints so the worker can report the real phase
(`parsing` vs `drafting`) instead of one opaque call.
"""

import logging

import httpx
from fastapi import APIRouter, HTTPException

from .schemas import DraftRequest, DraftResponse, ExtractionRequest, InvitationExtraction
from .service import (
    DraftGenerationError,
    InvitationExtractionError,
    draft_reply,
    extract_invitation,
)

logger = logging.getLogger(__name__)

router = APIRouter()


def _llm_unavailable(stage: str, error: Exception) -> HTTPException:
    logger.error("LLM request failed during %s: %s", stage, error)
    return HTTPException(status_code=502, detail={"error": "The language model is unavailable.", "stage": stage})


@router.post("/invitation-responder/extract", response_model=InvitationExtraction)
def extract(request: ExtractionRequest) -> InvitationExtraction:
    try:
        return extract_invitation(request.invitation_text)
    except InvitationExtractionError as error:
        raise HTTPException(status_code=422, detail={"error": str(error), "stage": "extraction"})
    except httpx.HTTPError as error:
        raise _llm_unavailable("extraction", error)


@router.post("/invitation-responder/draft", response_model=DraftResponse)
def draft(request: DraftRequest) -> DraftResponse:
    try:
        text = draft_reply(request.invitation_text, request.invitation, request.intent, request.candidate)
    except DraftGenerationError as error:
        raise HTTPException(status_code=422, detail={"error": str(error), "stage": "drafting"})
    except httpx.HTTPError as error:
        raise _llm_unavailable("drafting", error)
    return DraftResponse(draft_reply=text)

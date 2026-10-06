from fastapi.testclient import TestClient

from agents.invitation_responder import router as router_module
from agents.invitation_responder.schemas import InvitationExtraction
from agents.invitation_responder.service import DraftGenerationError, InvitationExtractionError
from agents.main import app

client = TestClient(app)

EXTRACTION = InvitationExtraction(
    recruiter_name="Alexis Aguiñaga",
    recruiter_title="Senior Talent Acquisition Consultant",
    company="Baxter International Inc.",
    role_title="Business Intelligence Specialist",
    location="Bogotá, D.C.",
    language="en",
)

CANDIDATE = {"full_name": "Rene Rangel", "top_skills": ["SQL"]}


def test_extract_endpoint_returns_the_structured_invitation(monkeypatch):
    monkeypatch.setattr(router_module, "extract_invitation", lambda text: EXTRACTION)

    res = client.post("/invitation-responder/extract", json={"invitation_text": "Hi Rene, ..."})

    assert res.status_code == 200
    assert res.json()["recruiter_name"] == "Alexis Aguiñaga"
    assert res.json()["language"] == "en"


def test_extract_endpoint_maps_a_validation_failure_to_422(monkeypatch):
    def boom(text):
        raise InvitationExtractionError("failed schema validation after one retry")

    monkeypatch.setattr(router_module, "extract_invitation", boom)

    res = client.post("/invitation-responder/extract", json={"invitation_text": "Hi"})

    assert res.status_code == 422
    assert res.json()["detail"]["stage"] == "extraction"
    assert "schema validation" in res.json()["detail"]["error"]


def test_extract_endpoint_rejects_a_blank_invitation():
    res = client.post("/invitation-responder/extract", json={"invitation_text": "   "})

    assert res.status_code == 422


def test_draft_endpoint_returns_the_draft_reply(monkeypatch):
    seen = {}

    def fake_draft(text, invitation, intent, candidate):
        seen.update(intent=intent, candidate=candidate)
        return "Hi Alexis, thank you."

    monkeypatch.setattr(router_module, "draft_reply", fake_draft)

    res = client.post(
        "/invitation-responder/draft",
        json={
            "invitation_text": "Hi Rene",
            "invitation": EXTRACTION.model_dump(),
            "intent": "request_more_info",
            "candidate": CANDIDATE,
        },
    )

    assert res.status_code == 200
    assert res.json() == {"draft_reply": "Hi Alexis, thank you."}
    assert seen["intent"].value == "request_more_info"
    assert seen["candidate"].full_name == "Rene Rangel"


def test_draft_endpoint_defaults_the_intent_to_interested(monkeypatch):
    seen = {}
    monkeypatch.setattr(
        router_module, "draft_reply", lambda t, i, intent, c: seen.setdefault("intent", intent) and "ok draft text"
    )

    client.post(
        "/invitation-responder/draft",
        json={"invitation_text": "Hi", "invitation": EXTRACTION.model_dump(), "candidate": CANDIDATE},
    )

    assert seen["intent"].value == "interested"


def test_draft_endpoint_maps_a_generation_failure_to_422(monkeypatch):
    def boom(*args):
        raise DraftGenerationError("model returned an empty draft")

    monkeypatch.setattr(router_module, "draft_reply", boom)

    res = client.post(
        "/invitation-responder/draft",
        json={"invitation_text": "Hi", "invitation": EXTRACTION.model_dump(), "candidate": CANDIDATE},
    )

    assert res.status_code == 422
    assert res.json()["detail"]["stage"] == "drafting"


def test_draft_endpoint_rejects_an_unknown_intent():
    res = client.post(
        "/invitation-responder/draft",
        json={
            "invitation_text": "Hi",
            "invitation": EXTRACTION.model_dump(),
            "intent": "send_it_now",
            "candidate": CANDIDATE,
        },
    )

    assert res.status_code == 422


def test_extract_endpoint_maps_an_unreachable_llm_to_502(monkeypatch):
    import httpx

    def boom(text):
        raise httpx.ConnectError("connection refused")

    monkeypatch.setattr(router_module, "extract_invitation", boom)

    res = client.post("/invitation-responder/extract", json={"invitation_text": "Hi"})

    assert res.status_code == 502
    assert res.json()["detail"]["stage"] == "extraction"

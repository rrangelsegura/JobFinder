from unittest.mock import MagicMock

from agents.cv_analyst.schemas import (
    CvExtractionResult,
    EducationEntry,
    LanguageEntry,
    PersonalInfo,
    SkillEntry,
    SkillType,
    WorkExperienceEntry,
)
from knowledge_base.embeddings import embedding_service

SAMPLE_EXTRACTION = CvExtractionResult(
    personal_info=PersonalInfo(first_name="Ada", last_name="Lovelace", email="ada@example.com"),
    education=[
        EducationEntry(institution="Cambridge", title="Mathematics", start_date="1840-01-01")
    ],
    work_experience=[
        WorkExperienceEntry(company="Analytical Engines Ltd", position="Analyst", start_date="1842-01-01")
    ],
    skills=[SkillEntry(name="Python", type=SkillType.technical)],
    languages=[LanguageEntry(name="English")],
    certifications=[],
)


# Spec: "chunk and embed the resume text into the resumes_embeddings vector
# collection, tagged by section"
def test_build_resume_chunks_produces_one_chunk_per_section_with_content():
    chunks = embedding_service.build_resume_chunks(SAMPLE_EXTRACTION)

    sections = [c["section"] for c in chunks]
    assert "personal_info" in sections
    assert "education" in sections
    assert "experience" in sections
    assert "skills" in sections
    assert "languages" in sections
    # certifications is empty on this fixture -> no chunk produced for it
    assert "certifications" not in sections
    assert all(c["text"].strip() for c in chunks)


def test_build_resume_chunks_produces_one_chunk_per_repeated_entry():
    extraction = SAMPLE_EXTRACTION.model_copy(
        update={
            "education": [
                EducationEntry(institution="Cambridge", title="Mathematics", start_date="1840-01-01"),
                EducationEntry(institution="Oxford", title="Philosophy", start_date="1845-01-01"),
            ]
        }
    )

    chunks = embedding_service.build_resume_chunks(extraction)
    education_chunks = [c for c in chunks if c["section"] == "education"]

    assert len(education_chunks) == 2
    assert "Cambridge" in education_chunks[0]["text"]
    assert "Oxford" in education_chunks[1]["text"]


# Spec: metadata { candidateId, chunk_index, section } per docs/data-model.md §4
def test_embed_resume_chunks_writes_to_chroma_with_correct_metadata():
    mock_collection = MagicMock()
    mock_client = MagicMock()
    mock_client.get_or_create_collection.return_value = mock_collection

    count = embedding_service.embed_resume_chunks(
        candidate_id=42,
        resume_id=7,
        extraction=SAMPLE_EXTRACTION,
        chroma_client=mock_client,
    )

    mock_client.get_or_create_collection.assert_called_once_with(
        embedding_service.RESUME_COLLECTION_NAME
    )
    assert count > 0
    mock_collection.add.assert_called_once()
    _, kwargs = mock_collection.add.call_args
    assert len(kwargs["documents"]) == count
    assert len(kwargs["metadatas"]) == count
    assert len(kwargs["ids"]) == count
    for metadata in kwargs["metadatas"]:
        assert metadata["candidateId"] == 42
        assert "chunk_index" in metadata
        assert "section" in metadata
    # ids must be unique and traceable back to the resume
    assert all(str(7) in doc_id for doc_id in kwargs["ids"])
    assert len(set(kwargs["ids"])) == count

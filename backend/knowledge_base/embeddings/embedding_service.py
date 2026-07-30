"""Chunk structured CV extraction data and embed it into the vector store.

Chunking is driven by the already-validated CvExtractionResult (from the LLM
extraction step) rather than re-deriving section boundaries from raw OCR text
with a separate heuristic — the structured data already IS the reliable
section split, so re-parsing the raw text would just reintroduce the ambiguity
the extraction step already resolved.

Per docs/data-model.md §4 (Vector Domain), each chunk is embedded into the
`resumes_embeddings` collection with metadata {candidateId, chunk_index, section}.
"""

import os
from typing import Optional

from agents.cv_analyst.schemas import CvExtractionResult

RESUME_COLLECTION_NAME = "resumes_embeddings"

CHROMA_URL = os.environ.get("CHROMA_URL", "http://localhost:8001")


def _default_client():
    import chromadb

    host, _, port = CHROMA_URL.replace("http://", "").replace("https://", "").partition(":")
    return chromadb.HttpClient(host=host, port=int(port) if port else 8000)


def build_resume_chunks(extraction: CvExtractionResult) -> list[dict]:
    """Build one (text, section) chunk per structured section / repeated entry.

    Sections with no entries (e.g. no certifications found) produce no chunk —
    embedding an empty chunk would just add noise to retrieval.
    """
    chunks: list[dict] = []

    p = extraction.personal_info
    chunks.append(
        {
            "section": "personal_info",
            "text": f"{p.first_name} {p.last_name} <{p.email}>",
        }
    )

    for edu in extraction.education:
        chunks.append(
            {
                "section": "education",
                "text": f"{edu.title} at {edu.institution} ({edu.start_date} - {edu.end_date or 'present'})",
            }
        )

    for exp in extraction.work_experience:
        text = f"{exp.position} at {exp.company} ({exp.start_date} - {exp.end_date or 'present'})"
        if exp.description:
            text += f": {exp.description}"
        chunks.append({"section": "experience", "text": text})

    if extraction.skills:
        chunks.append(
            {
                "section": "skills",
                "text": ", ".join(f"{s.name} ({s.type.value})" for s in extraction.skills),
            }
        )

    if extraction.languages:
        chunks.append(
            {
                "section": "languages",
                "text": ", ".join(
                    f"{lang.name} ({lang.proficiency})" if lang.proficiency else lang.name
                    for lang in extraction.languages
                ),
            }
        )

    if extraction.certifications:
        chunks.append(
            {
                "section": "certifications",
                "text": ", ".join(c.name for c in extraction.certifications),
            }
        )

    return chunks


def embed_resume_chunks(
    candidate_id: int,
    resume_id: int,
    extraction: CvExtractionResult,
    chroma_client: Optional[object] = None,
) -> int:
    """Chunk the extraction result and write it to the resumes_embeddings collection.

    Returns the number of chunks written. Uses Chroma's default embedding
    function (no separate embedding model call needed).
    """
    client = chroma_client or _default_client()
    collection = client.get_or_create_collection(RESUME_COLLECTION_NAME)

    chunks = build_resume_chunks(extraction)
    if not chunks:
        return 0

    documents = [c["text"] for c in chunks]
    metadatas = [
        {"candidateId": candidate_id, "chunk_index": i, "section": c["section"]}
        for i, c in enumerate(chunks)
    ]
    ids = [f"resume-{resume_id}-chunk-{i}" for i in range(len(chunks))]

    collection.add(documents=documents, metadatas=metadatas, ids=ids)
    return len(chunks)

"""OCR extraction: PyTesseract (primary), Amazon Textract (fallback).

Per docs/backend-standards.md's OCR capability list and specs/cv-extraction/spec.md's
"OCR Text Extraction" requirement.
"""

import logging

logger = logging.getLogger(__name__)


class OcrExtractionError(Exception):
    """Raised when both the primary and fallback OCR providers fail."""


def _extract_with_tesseract(pdf_path: str) -> str:
    from pdf2image import convert_from_path
    import pytesseract

    images = convert_from_path(pdf_path)
    pages = [pytesseract.image_to_string(image) for image in images]
    return "\n".join(pages)


def _extract_with_textract(pdf_path: str) -> str:
    import boto3

    client = boto3.client("textract")
    with open(pdf_path, "rb") as f:
        document_bytes = f.read()
    response = client.detect_document_text(Document={"Bytes": document_bytes})
    lines = [
        block["Text"]
        for block in response.get("Blocks", [])
        if block.get("BlockType") == "LINE"
    ]
    return "\n".join(lines)


def extract_text_from_pdf(pdf_path: str) -> str:
    """Extract raw text from a PDF via OCR.

    Tries PyTesseract first; falls back to Amazon Textract if the primary
    provider fails. Raises OcrExtractionError if both fail.
    """
    try:
        return _extract_with_tesseract(pdf_path)
    except Exception as tesseract_error:
        logger.warning(
            "Primary OCR (PyTesseract) failed for %s: %s", pdf_path, tesseract_error
        )
        try:
            return _extract_with_textract(pdf_path)
        except Exception as textract_error:
            logger.error(
                "Fallback OCR (Textract) failed for %s: %s", pdf_path, textract_error
            )
            raise OcrExtractionError(
                f"OCR failed on both providers for {pdf_path}: "
                f"tesseract={tesseract_error}; textract={textract_error}"
            ) from textract_error

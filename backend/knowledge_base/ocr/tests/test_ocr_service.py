import pytest

from knowledge_base.ocr import ocr_service


# Spec: "Primary OCR succeeds"
def test_extract_text_uses_primary_tesseract_when_it_succeeds(monkeypatch):
    monkeypatch.setattr(ocr_service, "_extract_with_tesseract", lambda path: "text from tesseract")
    monkeypatch.setattr(
        ocr_service,
        "_extract_with_textract",
        lambda path: (_ for _ in ()).throw(AssertionError("fallback should not be called")),
    )

    result = ocr_service.extract_text_from_pdf("cv.pdf")

    assert result == "text from tesseract"


# Spec: "Primary OCR fails and fallback is used"
def test_extract_text_falls_back_to_textract_when_tesseract_fails(monkeypatch):
    def failing_tesseract(path):
        raise RuntimeError("tesseract binary not found")

    monkeypatch.setattr(ocr_service, "_extract_with_tesseract", failing_tesseract)
    monkeypatch.setattr(ocr_service, "_extract_with_textract", lambda path: "text from textract")

    result = ocr_service.extract_text_from_pdf("cv.pdf")

    assert result == "text from textract"


# Spec: OCR Failure Handling — "OCR failure marks job failed"
# (this test covers the OCR-layer half: both providers fail -> raises OcrExtractionError)
def test_extract_text_raises_when_both_providers_fail(monkeypatch):
    def failing_tesseract(path):
        raise RuntimeError("tesseract binary not found")

    def failing_textract(path):
        raise RuntimeError("AWS credentials not configured")

    monkeypatch.setattr(ocr_service, "_extract_with_tesseract", failing_tesseract)
    monkeypatch.setattr(ocr_service, "_extract_with_textract", failing_textract)

    with pytest.raises(ocr_service.OcrExtractionError) as exc_info:
        ocr_service.extract_text_from_pdf("cv.pdf")

    assert "tesseract" in str(exc_info.value)
    assert "textract" in str(exc_info.value)

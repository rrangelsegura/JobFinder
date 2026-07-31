FROM python:3.11-slim

# Build context is backend/ (not backend/agents/) so this image can include
# the sibling backend/knowledge_base/ package that agents import from.
WORKDIR /app

# tesseract-ocr: primary OCR provider (pytesseract is just a wrapper around this binary).
# poppler-utils: provides pdftoppm, which pdf2image shells out to for PDF->image conversion.
RUN apt-get update \
    && apt-get install -y --no-install-recommends tesseract-ocr poppler-utils \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY agents ./agents
COPY knowledge_base ./knowledge_base

EXPOSE 8000

CMD ["uvicorn", "agents.main:app", "--host", "0.0.0.0", "--port", "8000"]

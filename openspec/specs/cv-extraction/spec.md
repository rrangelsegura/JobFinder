# cv-extraction Specification

## Purpose

Runs OCR against an uploaded CV PDF and prompts a local LLM to produce structured, Pydantic-validated candidate data (personal info, education, work experience, and skills/languages/certifications when present), persisting the results and embedding the resume text into the vector store for later RAG/matching use.

## Requirements

### Requirement: OCR Text Extraction
The system SHALL run OCR against the uploaded PDF to obtain raw text, using a fallback OCR provider if the primary provider fails.

#### Scenario: Primary OCR succeeds
- **WHEN** the extraction job runs OCR against a readable PDF
- **THEN** the primary OCR provider returns raw text and processing continues to structured extraction

#### Scenario: Primary OCR fails and fallback is used
- **WHEN** the primary OCR provider fails to process the PDF
- **THEN** the system retries the OCR step with the fallback provider before failing the job

### Requirement: Structured LLM Extraction
The system SHALL prompt a local LLM to produce candidate data validated against a Pydantic schema. Free-form, unvalidated JSON output SHALL NOT be accepted as a successful extraction result.

#### Scenario: LLM output passes schema validation
- **WHEN** the LLM returns output that validates against the extraction Pydantic schema
- **THEN** the system accepts the output and proceeds to persistence

#### Scenario: LLM output fails schema validation and is retried
- **WHEN** the LLM's first output fails schema validation
- **THEN** the system retries once with a refined prompt

#### Scenario: LLM output fails validation after retry
- **WHEN** the LLM's output fails schema validation on the retry attempt as well
- **THEN** the system marks the job `failed` with a user-facing reason and does not persist partial data

### Requirement: Extracted Field Coverage
The system SHALL extract personal information, education, and work experience from every successfully processed CV, and SHALL additionally extract technical/soft skills, languages, and certifications when present in the source document.

#### Scenario: CV with all field groups present extracts all groups
- **WHEN** a CV contains personal info, education, work experience, skills, languages, and certifications
- **THEN** the extraction output includes all six field groups

#### Scenario: CV missing optional field groups still succeeds
- **WHEN** a CV contains personal info, education, and work experience but no skills, languages, or certifications section
- **THEN** the extraction succeeds with the mandatory field groups populated and the optional groups empty, without failing the job

### Requirement: Persistence and Embedding of Extraction Results
On successful extraction, the system SHALL persist the structured `Candidate`, `Education`, and `WorkExperience` data, and SHALL chunk and embed the resume text into the `resumes_embeddings` vector collection, tagged by section (e.g. `skills`, `experience`).

#### Scenario: Successful extraction persists structured data and embeddings
- **WHEN** an extraction job completes successfully
- **THEN** the system persists the corresponding `Candidate`/`Education`/`WorkExperience` records and writes section-tagged chunks to `resumes_embeddings`

### Requirement: Extraction Failure Handling
On unrecoverable OCR failure or LLM schema-validation failure after retry, the system SHALL mark the job `failed` with a user-facing reason and SHALL NOT persist partial or invalid candidate data.

#### Scenario: OCR failure marks job failed
- **WHEN** OCR fails on both the primary and fallback provider
- **THEN** the system marks the job `failed` with a user-facing reason and persists no candidate data

#### Scenario: LLM failure after retry marks job failed without partial persistence
- **WHEN** the LLM output fails schema validation on both attempts
- **THEN** the system marks the job `failed` and does not persist any `Candidate`/`Education`/`WorkExperience` records for that job

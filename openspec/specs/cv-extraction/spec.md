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
The system SHALL prompt a local LLM to produce candidate data validated against a Pydantic schema. Free-form, unvalidated JSON output SHALL NOT be accepted as a successful extraction result. The prompt SHALL reinforce the required structured shape (e.g. each skill/language as an object, not a string) regardless of how many items a given list contains, and the retry prompt SHALL stay within the model's usable context budget rather than unconditionally concatenating the full resume text, the full previous output, and the full validation error list.

#### Scenario: LLM output passes schema validation
- **WHEN** the LLM returns output that validates against the extraction Pydantic schema
- **THEN** the system accepts the output and proceeds to persistence

#### Scenario: LLM output fails schema validation and is retried
- **WHEN** the LLM's first output fails schema validation
- **THEN** the system retries once with a refined prompt that stays within the model's context budget

#### Scenario: Long lists still produce the required structured shape
- **WHEN** a resume contains many skills or languages (more items than the prompt's worked example shows)
- **THEN** the extraction prompt still requires each item as a structured object, not a flat string, regardless of list length

#### Scenario: LLM output fails validation after retry
- **WHEN** the LLM's output fails schema validation on the retry attempt as well
- **THEN** the system marks the job `failed` with a user-facing reason and does not persist partial data

### Requirement: Extracted Field Coverage
The system SHALL extract personal information, education, and work experience from every successfully processed CV, and SHALL additionally extract technical/soft skills, languages, and certifications when present in the source document. Work experience extraction SHALL additionally capture, when present in the source document: role-level responsibilities as a list of items, and a list of projects, each with its own name, optional description, achievements, and technology stack.

#### Scenario: CV with all field groups present extracts all groups
- **WHEN** a CV contains personal info, education, work experience, skills, languages, and certifications
- **THEN** the extraction output includes all six field groups

#### Scenario: CV missing optional field groups still succeeds
- **WHEN** a CV contains personal info, education, and work experience but no skills, languages, or certifications section
- **THEN** the extraction succeeds with the mandatory field groups populated and the optional groups empty, without failing the job

#### Scenario: Work experience with responsibilities and projects extracts both
- **WHEN** a work experience entry in the source CV lists both general responsibilities and one or more named projects with achievements and a tech stack
- **THEN** the extraction output for that entry includes a `responsibilities` list and a `projects` list, each project carrying its own `achievements` and `stack` lists

#### Scenario: Work experience without a projects breakdown still succeeds
- **WHEN** a work experience entry has only a general description, with no distinct responsibilities list or named projects
- **THEN** the extraction succeeds with that entry's `responsibilities` and `projects` lists empty, without failing the job

### Requirement: Persistence and Embedding of Extraction Results
On successful extraction, the system SHALL persist the structured `Candidate`, `Education`, and `WorkExperience` data — including each work experience's responsibilities and projects (with each project's achievements and stack) — and SHALL chunk and embed the resume text into the `resumes_embeddings` vector collection, tagged by section (e.g. `skills`, `experience`).

#### Scenario: Successful extraction persists structured data and embeddings
- **WHEN** an extraction job completes successfully
- **THEN** the system persists the corresponding `Candidate`/`Education`/`WorkExperience` records, each work experience's responsibilities and projects (with each project's achievements and stack), and writes section-tagged chunks to `resumes_embeddings`

### Requirement: Extraction Failure Handling
On unrecoverable OCR failure or LLM schema-validation failure after retry, the system SHALL mark the job `failed` with a user-facing reason and SHALL NOT persist partial or invalid candidate data. This all-or-nothing guarantee applies to OCR failure and to the flat extraction call (personal info, education, work experience's core fields, skills, languages, certifications). It does NOT apply to a single work experience entry's detail extraction (responsibilities/projects): if that entry's detail call fails schema validation after its own retry, the system SHALL persist that entry's flat fields with empty `responsibilities`/`projects` rather than failing the whole job, and SHALL log the absorbed failure.

#### Scenario: OCR failure marks job failed
- **WHEN** OCR fails on both the primary and fallback provider
- **THEN** the system marks the job `failed` with a user-facing reason and persists no candidate data

#### Scenario: LLM failure after retry marks job failed without partial persistence
- **WHEN** the flat extraction call's output fails schema validation on both attempts
- **THEN** the system marks the job `failed` and does not persist any `Candidate`/`Education`/`WorkExperience` records for that job

#### Scenario: A single work experience's detail failure does not fail the job
- **WHEN** one work experience entry's detail extraction (responsibilities/projects) fails schema validation on both its initial attempt and its own retry, while the flat extraction call itself succeeded
- **THEN** the system persists the job's full result — including that work experience entry's flat fields — with that entry's `responsibilities` and `projects` left empty, logs the absorbed failure, and does not mark the job `failed`

### Requirement: Re-processing an Already-Extracted Resume Replaces, Not Accumulates
When a resume that has already been successfully extracted is re-processed, the system SHALL replace that candidate's existing `Education`, `WorkExperience` (and its responsibilities/projects/achievements/stack), `Skill`, `Language`, and `Certification` records with the fresh extraction result, rather than adding to them, and SHALL perform the replacement and the new writes within the same transaction so a failed re-extraction never leaves the candidate with data removed and nothing to replace it.

#### Scenario: Re-processing replaces prior structured data
- **WHEN** a candidate's already-extracted resume is re-processed and the new extraction succeeds
- **THEN** the candidate's prior `Education`/`WorkExperience`/`Skill`/`Language`/`Certification` records are replaced by the new extraction result, with no duplicate or leftover records from the prior run

#### Scenario: Failed re-extraction leaves prior data intact
- **WHEN** a candidate's already-extracted resume is re-processed and the new extraction fails schema validation after retry
- **THEN** the candidate's prior `Education`/`WorkExperience`/`Skill`/`Language`/`Certification` records remain unchanged

### Requirement: Work Experience Detail Extracted via Isolated Per-Job Calls
The system SHALL extract each work experience entry's responsibilities and projects (with their achievements and stack) via a separate LLM call per entry, distinct from the flat extraction call that produces personal info, education, each work experience's core fields, skills, languages, and certifications. Each per-job detail call SHALL retry once independently on schema-validation failure, using the same context-budgeted, error-summarized retry approach as the flat call.

#### Scenario: Each work experience gets its own detail call
- **WHEN** the flat extraction call succeeds and returns N work experience entries
- **THEN** the system makes N separate detail calls, one per entry, before returning the final merged result

#### Scenario: A detail call's retry is independent of other detail calls
- **WHEN** one work experience entry's detail call fails schema validation on its first attempt
- **THEN** the system retries only that entry's detail call once, without re-running the flat call or any other entry's detail call

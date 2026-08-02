## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Work Experience Detail Extracted via Isolated Per-Job Calls
The system SHALL extract each work experience entry's responsibilities and projects (with their achievements and stack) via a separate LLM call per entry, distinct from the flat extraction call that produces personal info, education, each work experience's core fields, skills, languages, and certifications. Each per-job detail call SHALL retry once independently on schema-validation failure, using the same context-budgeted, error-summarized retry approach as the flat call.

#### Scenario: Each work experience gets its own detail call
- **WHEN** the flat extraction call succeeds and returns N work experience entries
- **THEN** the system makes N separate detail calls, one per entry, before returning the final merged result

#### Scenario: A detail call's retry is independent of other detail calls
- **WHEN** one work experience entry's detail call fails schema validation on its first attempt
- **THEN** the system retries only that entry's detail call once, without re-running the flat call or any other entry's detail call

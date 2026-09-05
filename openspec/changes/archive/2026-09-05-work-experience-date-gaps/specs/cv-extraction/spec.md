## MODIFIED Requirements

### Requirement: Extracted Field Coverage
The system SHALL extract personal information, education, and work experience from every successfully processed CV, and SHALL additionally extract technical/soft skills, languages, and certifications when present in the source document. Work experience extraction SHALL additionally capture, when present in the source document: role-level responsibilities as a list of items, and a list of projects, each with its own name, optional description, achievements, and technology stack. A skill's `type` SHALL classify it as `technical` or `soft` only; a stated proficiency level (e.g. "Advanced", "Intermediate") SHALL be captured in a separate optional `proficiency` field, never substituted into `type`. An education or work experience entry with no stated start date SHALL extract with `start_date` omitted rather than failing the job. A work experience entry stating only a duration (e.g. "6 months", "2 years") rather than an actual end date SHALL extract with `end_date` omitted rather than failing the job.

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

#### Scenario: A skill's stated proficiency level does not fail extraction
- **WHEN** the source CV states a proficiency level for a skill (e.g. "Scrum — Intermediate")
- **THEN** the extraction output includes that skill with `type` set to `technical` or `soft` and the proficiency level captured in the `proficiency` field, without failing the job

#### Scenario: An education entry with no stated start date still succeeds
- **WHEN** an education entry in the source CV states no start date (e.g. only a graduation year)
- **THEN** the extraction succeeds with that entry's `start_date` omitted, without failing the job

#### Scenario: A work experience entry with no stated start date still succeeds
- **WHEN** a work experience entry in the source CV states no start date
- **THEN** the extraction succeeds with that entry's `start_date` omitted, without failing the job

#### Scenario: A work experience entry stating only a duration still succeeds
- **WHEN** a work experience entry in the source CV states a duration (e.g. "6 meses", "2 years") instead of an actual end date
- **THEN** the extraction succeeds with that entry's `end_date` omitted, without failing the job

### Requirement: Persistence and Embedding of Extraction Results
On successful extraction, the system SHALL persist the structured `Education` and `WorkExperience` data against the `Candidate` — including each work experience's responsibilities and projects (with each project's achievements and stack) — SHALL persist extracted personal info (name, email, phone, address) against the specific `Resume` record rather than the `Candidate`, and SHALL chunk and embed the resume text into the `resumes_embeddings` vector collection, tagged by section (e.g. `skills`, `experience`). `Candidate.email` SHALL NOT be modified by extraction, since it is the candidate's login credential and is independent of any single resume's reported contact info. A project's `name` SHALL persist without truncation or failure up to 300 characters. A skill's `proficiency`, when extracted, SHALL persist alongside its `name` and `type`. An education or work experience entry with no extracted start date SHALL persist with a `NULL` `startDate` rather than a fabricated value.

#### Scenario: Successful extraction persists structured data and embeddings
- **WHEN** an extraction job completes successfully
- **THEN** the system persists the corresponding `Education`/`WorkExperience` records against the candidate (including each work experience's responsibilities and projects, with each project's achievements and stack), persists the extracted personal info against the `Resume` record for that job, and writes section-tagged chunks to `resumes_embeddings`

#### Scenario: Extraction never changes the candidate's login email
- **WHEN** an extraction job completes with a `personal_info.email` different from the candidate's registered account email
- **THEN** the system persists the extracted email only on the `Resume` record and `Candidate.email` remains unchanged

#### Scenario: A long project name persists without truncation
- **WHEN** a work experience entry's extracted project has a `name` up to 300 characters
- **THEN** the system persists the full project name without truncation, error, or job failure

#### Scenario: A skill's proficiency persists alongside its type
- **WHEN** an extracted skill has both a `type` and a stated `proficiency`
- **THEN** the system persists both fields on the `Skill` record

#### Scenario: An education entry with no start date persists with a NULL startDate
- **WHEN** an extracted education entry has no `start_date`
- **THEN** the system persists that `Education` record with `startDate` set to `NULL` rather than failing the transaction

#### Scenario: A work experience entry with no start date persists with a NULL startDate
- **WHEN** an extracted work experience entry has no `start_date`
- **THEN** the system persists that `WorkExperience` record with `startDate` set to `NULL` rather than failing the transaction

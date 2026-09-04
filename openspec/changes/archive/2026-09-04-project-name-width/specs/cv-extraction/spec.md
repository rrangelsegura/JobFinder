## MODIFIED Requirements

### Requirement: Persistence and Embedding of Extraction Results
On successful extraction, the system SHALL persist the structured `Education` and `WorkExperience` data against the `Candidate` — including each work experience's responsibilities and projects (with each project's achievements and stack) — SHALL persist extracted personal info (name, email, phone, address) against the specific `Resume` record rather than the `Candidate`, and SHALL chunk and embed the resume text into the `resumes_embeddings` vector collection, tagged by section (e.g. `skills`, `experience`). `Candidate.email` SHALL NOT be modified by extraction, since it is the candidate's login credential and is independent of any single resume's reported contact info. A project's `name` SHALL persist without truncation or failure up to 300 characters.

#### Scenario: Successful extraction persists structured data and embeddings
- **WHEN** an extraction job completes successfully
- **THEN** the system persists the corresponding `Education`/`WorkExperience` records against the candidate (including each work experience's responsibilities and projects, with each project's achievements and stack), persists the extracted personal info against the `Resume` record for that job, and writes section-tagged chunks to `resumes_embeddings`

#### Scenario: Extraction never changes the candidate's login email
- **WHEN** an extraction job completes with a `personal_info.email` different from the candidate's registered account email
- **THEN** the system persists the extracted email only on the `Resume` record and `Candidate.email` remains unchanged

#### Scenario: A long project name persists without truncation
- **WHEN** a work experience entry's extracted project has a `name` up to 300 characters
- **THEN** the system persists the full project name without truncation, error, or job failure

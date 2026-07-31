## MODIFIED Requirements

### Requirement: Persistence and Embedding of Extraction Results
On successful extraction, the system SHALL persist the structured `Education` and `WorkExperience` data against the `Candidate`, SHALL persist extracted personal info (name, email, phone, address) against the specific `Resume` record rather than the `Candidate`, and SHALL chunk and embed the resume text into the `resumes_embeddings` vector collection, tagged by section (e.g. `skills`, `experience`). `Candidate.email` SHALL NOT be modified by extraction, since it is the candidate's login credential and is independent of any single resume's reported contact info.

#### Scenario: Successful extraction persists structured data and embeddings
- **WHEN** an extraction job completes successfully
- **THEN** the system persists the corresponding `Education`/`WorkExperience` records against the candidate, persists the extracted personal info against the `Resume` record for that job, and writes section-tagged chunks to `resumes_embeddings`

#### Scenario: Extraction never changes the candidate's login email
- **WHEN** an extraction job completes with a `personal_info.email` different from the candidate's registered account email
- **THEN** the system persists the extracted email only on the `Resume` record and `Candidate.email` remains unchanged

## ADDED Requirements

### Requirement: Candidate Notified of Resume/Account Email Mismatch
When a completed extraction's reported email differs from the candidate's account email, the system SHALL inform the candidate rather than silently applying or silently ignoring the difference.

#### Scenario: Mismatch surfaced as a non-blocking notice
- **WHEN** a completed extraction's `personal_info.email` does not match the candidate's account email
- **THEN** the UI displays a non-blocking notice naming both the CV-reported email and the account email, without altering the account email

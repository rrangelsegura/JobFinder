## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Re-processing an Already-Extracted Resume Replaces, Not Accumulates
When a resume that has already been successfully extracted is re-processed, the system SHALL replace that candidate's existing `Education`, `WorkExperience` (and its responsibilities/projects/achievements/stack), `Skill`, `Language`, and `Certification` records with the fresh extraction result, rather than adding to them, and SHALL perform the replacement and the new writes within the same transaction so a failed re-extraction never leaves the candidate with data removed and nothing to replace it.

#### Scenario: Re-processing replaces prior structured data
- **WHEN** a candidate's already-extracted resume is re-processed and the new extraction succeeds
- **THEN** the candidate's prior `Education`/`WorkExperience`/`Skill`/`Language`/`Certification` records are replaced by the new extraction result, with no duplicate or leftover records from the prior run

#### Scenario: Failed re-extraction leaves prior data intact
- **WHEN** a candidate's already-extracted resume is re-processed and the new extraction fails schema validation after retry
- **THEN** the candidate's prior `Education`/`WorkExperience`/`Skill`/`Language`/`Certification` records remain unchanged

## ADDED Requirements

### Requirement: Candidate Can Fetch Their Own Persisted Analysis Results
The system SHALL provide a self-scoped endpoint that returns the authenticated candidate's persisted CV extraction results — personal info from their most recent resume with completed extraction, education, work experience (with responsibilities, projects, achievements, and stack), skills (with proficiency), languages, and certifications — read from the database, not from transient job-queue state.

#### Scenario: Candidate with a completed extraction fetches their results
- **WHEN** an authenticated candidate whose most recent resume completed extraction requests their analysis results
- **THEN** the system returns `hasAnalysis: true` along with that resume's personal info and the candidate's education, work experience, skills, languages, and certifications

#### Scenario: Results reflect the database, not a specific upload's job state
- **WHEN** an authenticated candidate requests their analysis results at any time after a successful extraction — including after the originating upload's job-queue history has expired
- **THEN** the system still returns the persisted data, since it is read directly from the candidate's database records

#### Scenario: Unauthenticated request is rejected
- **WHEN** a request with no valid session is made to the analysis results endpoint
- **THEN** the system responds 401 and returns no candidate data

### Requirement: Candidate With No Completed Extraction Sees an Honest Empty State
When a candidate has never had a resume complete extraction, the system SHALL indicate this explicitly rather than returning empty data indistinguishable from "extraction found nothing."

#### Scenario: Candidate who never uploaded a CV
- **WHEN** an authenticated candidate with no resumes at all requests their analysis results
- **THEN** the system returns `hasAnalysis: false`

#### Scenario: Candidate whose only upload is still processing or failed
- **WHEN** an authenticated candidate's only resume has not completed extraction (still processing, or failed)
- **THEN** the system returns `hasAnalysis: false`, not an empty populated result

### Requirement: Analysis Results Page Displays Persisted Data Read-Only
The frontend SHALL render the authenticated candidate's analysis results as a read-only view, grouped by section (personal info, education, work experience, skills, languages, certifications), and SHALL NOT provide any way to edit the displayed data.

#### Scenario: Candidate with results views the Analysis Results page
- **WHEN** a candidate with `hasAnalysis: true` navigates to the Analysis Results page
- **THEN** the page renders their personal info, education, work experience (including responsibilities and projects), skills, languages, and certifications, with no edit controls

#### Scenario: Candidate with no results yet views the Analysis Results page
- **WHEN** a candidate with `hasAnalysis: false` navigates to the Analysis Results page
- **THEN** the page clearly states no analysis is available yet and directs them to the Upload page, rather than showing empty sections

## MODIFIED Requirements

### Requirement: Non-Technical Failure Messaging
On extraction failure, the UI SHALL show a clear, non-technical error message. It SHALL NOT render the backend's raw internal error string. For a system-side failure (OCR or LLM extraction, as opposed to a problem with the candidate's file itself), the message SHALL make clear the failure is JobFinder's issue, not something the candidate needs to fix, and SHALL NOT instruct the candidate to simply try again.

#### Scenario: Job fails and a friendly message is shown
- **WHEN** the tracked job's status transitions to `failed`
- **THEN** the UI displays a non-technical message describing the failure, distinct from the raw `data.error` string returned by the backend

#### Scenario: System-side failure is distinguished from a user-fixable one
- **WHEN** the tracked job fails due to a system-side extraction problem (OCR or LLM schema validation), as opposed to a problem with the uploaded file itself
- **THEN** the UI's message states the issue is on JobFinder's side, that a fix is being worked on, and that the candidate will be notified once they can retry — it does not tell the candidate to simply try again

## ADDED Requirements

### Requirement: Bordered, Styled Form Inputs
Form inputs across the candidate-facing UI (login, register, CV upload) SHALL use the project's design system components with visible field boundaries, not unstyled native form elements.

#### Scenario: Form fields have a visible border
- **WHEN** a candidate views the login, register, or CV upload form
- **THEN** each input field is visibly bounded and styled consistently with the rest of the interface

### Requirement: Candidate Notified of System-Side Extraction Failures
When a CV extraction job fails for a system-side reason, the system SHALL send the candidate a one-shot email acknowledging the failure is on JobFinder's side and that a fix is being worked on.

#### Scenario: System-side failure triggers an acknowledgment email
- **WHEN** a CV extraction job fails for a system-side reason (OCR or LLM schema validation)
- **THEN** the system sends exactly one email to that candidate acknowledging the failure and that they'll be notified once resolved

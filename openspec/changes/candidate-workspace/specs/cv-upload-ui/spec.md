## ADDED Requirements

### Requirement: CV Submission from the Upload Section
The Upload section SHALL let an authenticated candidate select and submit a PDF CV, invoking the existing `cv-upload` backend capability.

#### Scenario: Valid PDF submitted successfully
- **WHEN** the candidate selects a PDF file and submits it
- **THEN** the system calls `POST /uploads/cv` and, on `202`, begins tracking the returned job

### Requirement: Processing State Visibility
While the extraction job is processing, the UI SHALL reflect a "processing" state rather than a blank screen or a state indistinguishable from success or failure.

#### Scenario: Job still processing shows a processing indicator
- **WHEN** the tracked job's status is `processing`
- **THEN** the UI displays a visible processing indicator and does not display success or failure content

### Requirement: Completion Reflected Without Manual Refresh
Once the extraction job completes, the UI SHALL reflect success without requiring the candidate to reload the page or manually re-check.

#### Scenario: Job completes while the candidate is on the page
- **WHEN** the tracked job's status transitions to `completed`
- **THEN** the UI updates to a success state automatically, without a page reload

### Requirement: Non-Technical Failure Messaging
On extraction failure, the UI SHALL show a clear, non-technical error message. It SHALL NOT render the backend's raw internal error string.

#### Scenario: Job fails and a friendly message is shown
- **WHEN** the tracked job's status transitions to `failed`
- **THEN** the UI displays a non-technical message describing the failure, distinct from the raw `data.error` string returned by the backend

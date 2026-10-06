## ADDED Requirements

### Requirement: Invitation Reply Page
The frontend SHALL provide an authenticated "Invitation Replies" page with a multi-line text field for the invitation, an intent selector (`interested` default, `request_more_info`, `decline`), and a submit button disabled while the text is blank or over 5000 characters.

#### Scenario: Submit is disabled for blank text
- **WHEN** the text field is empty or whitespace
- **THEN** the submit button is disabled

#### Scenario: Character limit is communicated
- **WHEN** the text exceeds 5000 characters
- **THEN** the page shows a limit message and keeps submit disabled

### Requirement: Draft Progress and Result Display
After submission the page SHALL poll the status endpoint, show the current phase in human-readable form, and on completion show the parsed invitation summary (recruiter, company, role, location) and the draft reply in a read-only area with a "Copy" action. On failure it SHALL show the error message and allow retrying with the same text.

#### Scenario: Progress is shown while processing
- **WHEN** the job is `processing`
- **THEN** the page shows a message matching the current `phase`

#### Scenario: Completed draft is displayed and copyable
- **WHEN** the job completes
- **THEN** the page shows the parsed summary and the draft, and "Copy" places the draft text on the clipboard

#### Scenario: Failure allows retry
- **WHEN** the job fails
- **THEN** the page shows the error and a retry action that resubmits the preserved text

#### Scenario: The draft is clearly not sent
- **WHEN** the draft is displayed
- **THEN** the page states the message has not been sent and must be reviewed and sent by the candidate

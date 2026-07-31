## MODIFIED Requirements

### Requirement: Resume Record Persistence
The system SHALL persist a `Resume` record (`filePath`, `fileType`, `uploadDate`, `candidateId`) upon successful upload validation, before enqueueing the extraction job. `candidateId` SHALL be derived from the authenticated session via the `requireAuth` middleware, never from the request body or any other client-supplied value.

#### Scenario: Resume record created on valid upload
- **WHEN** an authenticated candidate's valid PDF passes validation
- **THEN** the system persists a `Resume` row with `filePath`, `fileType`, `uploadDate`, and `candidateId` set to the session's candidate id

## ADDED Requirements

### Requirement: Authenticated Upload Required
The system SHALL reject `POST /uploads/cv` with `401` if the request has no valid authenticated session, before any file processing, validation, or persistence occurs.

#### Scenario: Unauthenticated upload rejected
- **WHEN** a request to `POST /uploads/cv` has no valid session cookie
- **THEN** the system responds `401` and does not persist a Resume record or enqueue an extraction job

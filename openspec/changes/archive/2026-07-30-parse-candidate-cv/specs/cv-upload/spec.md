## ADDED Requirements

### Requirement: PDF Upload Validation
The system SHALL accept CV uploads only as `multipart/form-data` containing a PDF file, and SHALL reject the request with `400` if the file is missing, is not `application/pdf`, or exceeds 10MB.

#### Scenario: Valid PDF within size limit is accepted
- **WHEN** a candidate uploads a PDF file of 3MB via `POST /uploads/cv`
- **THEN** the system accepts the request and proceeds to persistence and job enqueue

#### Scenario: Non-PDF file is rejected
- **WHEN** a candidate uploads a `.docx` file via `POST /uploads/cv`
- **THEN** the system responds `400` with an unsupported file type error and does not persist a Resume record

#### Scenario: Oversized file is rejected
- **WHEN** a candidate uploads a PDF file larger than 10MB
- **THEN** the system responds `400` with a file size exceeded error

### Requirement: Corrupted or Unreadable File Handling
The system SHALL reject files that pass MIME/size validation but cannot be parsed as a valid PDF, returning a clear "unreadable/corrupted file" error rather than enqueuing a job that will fail downstream.

#### Scenario: Corrupted PDF rejected at upload
- **WHEN** a candidate uploads a file with a valid PDF MIME type and size but corrupted internal structure
- **THEN** the system responds with a clear unreadable/corrupted file error and does not enqueue an extraction job

### Requirement: Resume Record Persistence
The system SHALL persist a `Resume` record (`filePath`, `fileType`, `uploadDate`, `candidateId`) upon successful upload validation, before enqueueing the extraction job.

#### Scenario: Resume record created on valid upload
- **WHEN** a valid PDF passes validation
- **THEN** the system persists a `Resume` row with `filePath`, `fileType`, `uploadDate`, and `candidateId` set

### Requirement: Asynchronous Extraction Job Enqueue
The system SHALL process CV extraction asynchronously: upon successful validation and persistence, it SHALL enqueue an extraction job and respond `202` with `{ resumeId, jobId, status: "processing" }` instead of processing the extraction inline.

#### Scenario: Upload returns 202 with a trackable job id
- **WHEN** a valid PDF is uploaded and the Resume record is persisted
- **THEN** the system enqueues an extraction job and responds `202` with a body containing `resumeId`, `jobId`, and `status: "processing"`

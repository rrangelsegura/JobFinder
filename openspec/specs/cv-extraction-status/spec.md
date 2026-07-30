# cv-extraction-status Specification

## Purpose

Exposes the status of an async CV extraction job (`processing | completed | failed`) and, once completed, the structured candidate payload, via polling.

## Requirements

### Requirement: Extraction Job Status Retrieval
The system SHALL expose `GET /uploads/cv/{jobId}` to retrieve the current status of an extraction job (`processing`, `completed`, or `failed`) and, when `completed`, the structured candidate data.

#### Scenario: Query status of a processing job
- **WHEN** a client requests `GET /uploads/cv/{jobId}` for a job still being processed
- **THEN** the system responds `200` with `status: "processing"` and no candidate data

#### Scenario: Query status of a completed job returns candidate data
- **WHEN** a client requests `GET /uploads/cv/{jobId}` for a job that finished successfully
- **THEN** the system responds `200` with `status: "completed"` and the structured `Candidate` payload

#### Scenario: Query status of a failed job returns error reason
- **WHEN** a client requests `GET /uploads/cv/{jobId}` for a job that failed
- **THEN** the system responds `200` with `status: "failed"` and a user-facing error message

#### Scenario: Unknown job id returns 404
- **WHEN** a client requests `GET /uploads/cv/{jobId}` with a `jobId` that does not exist
- **THEN** the system responds `404`

### Requirement: Standard Response Envelope
Every response from `GET /uploads/cv/{jobId}` SHALL follow the platform's standard envelope, including `status`, `data`, `agent_trace_id`, and `model_used`.

#### Scenario: Response includes trace and model metadata
- **WHEN** a client requests the status of any existing job
- **THEN** the response body includes `agent_trace_id` and `model_used` alongside `status` and `data`

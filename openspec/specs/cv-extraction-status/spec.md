# cv-extraction-status Specification

## Purpose

Exposes the status of an async CV extraction job (`processing | completed | failed`) and, once completed, the structured candidate payload, via polling.
## Requirements
### Requirement: Extraction Job Status Retrieval
The system SHALL expose `GET /uploads/cv/{jobId}` to retrieve the current status of an extraction job (`processing`, `completed`, or `failed`) and, when `completed`, the structured candidate data. When `status` is `processing`, the response SHALL additionally include a `phase` of `"queued"`, `"extracting"`, or `"saving"`, reflecting which real step the job is currently in. When `status` is `completed` or `failed`, the response SHALL additionally include `durationMs`, the total elapsed time in milliseconds from when the job was enqueued to when it reached that terminal state.

#### Scenario: Query status of a processing job
- **WHEN** a client requests `GET /uploads/cv/{jobId}` for a job still being processed
- **THEN** the system responds `200` with `status: "processing"` and no candidate data

#### Scenario: Query status of a queued job reports the queued phase
- **WHEN** a client requests `GET /uploads/cv/{jobId}` for a job that has not yet been picked up by the worker (BullMQ state `waiting` or `delayed`)
- **THEN** the system responds with `status: "processing"` and `phase: "queued"`

#### Scenario: Query status of a job calling the extraction agent reports the extracting phase
- **WHEN** a client requests `GET /uploads/cv/{jobId}` for a job whose worker is currently awaiting the Python agent's response
- **THEN** the system responds with `status: "processing"` and `phase: "extracting"`

#### Scenario: Query status of a job persisting results reports the saving phase
- **WHEN** a client requests `GET /uploads/cv/{jobId}` for a job whose worker is currently running the Prisma persistence transaction
- **THEN** the system responds with `status: "processing"` and `phase: "saving"`

#### Scenario: Query status of a completed job returns candidate data
- **WHEN** a client requests `GET /uploads/cv/{jobId}` for a job that finished successfully
- **THEN** the system responds `200` with `status: "completed"` and the structured `Candidate` payload

#### Scenario: Completed job reports its total duration
- **WHEN** a client requests `GET /uploads/cv/{jobId}` for a job that finished successfully
- **THEN** the response includes `durationMs`, the elapsed time from when the job was enqueued to when it completed

#### Scenario: Query status of a failed job returns error reason
- **WHEN** a client requests `GET /uploads/cv/{jobId}` for a job that failed
- **THEN** the system responds `200` with `status: "failed"` and a user-facing error message

#### Scenario: Failed job also reports its total duration
- **WHEN** a client requests `GET /uploads/cv/{jobId}` for a job that failed
- **THEN** the response includes `durationMs`, the elapsed time from when the job was enqueued to when it failed

#### Scenario: Unknown job id returns 404
- **WHEN** a client requests `GET /uploads/cv/{jobId}` with a `jobId` that does not exist
- **THEN** the system responds `404`

### Requirement: Standard Response Envelope
Every response from `GET /uploads/cv/{jobId}` SHALL follow the platform's standard envelope, including `status`, `data`, `agent_trace_id`, and `model_used`.

#### Scenario: Response includes trace and model metadata
- **WHEN** a client requests the status of any existing job
- **THEN** the response body includes `agent_trace_id` and `model_used` alongside `status` and `data`


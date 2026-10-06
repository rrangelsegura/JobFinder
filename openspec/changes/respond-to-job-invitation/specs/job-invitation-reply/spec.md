## ADDED Requirements

### Requirement: Invitation Reply Draft Submission
The system SHALL expose `POST /invitations/reply-drafts` to authenticated candidates. The body SHALL contain `invitationText` (required, trimmed, 1–5000 characters) and MAY contain `intent` (`interested`, `request_more_info`, or `decline`; default `interested`). On success the system SHALL respond `202` with a `jobId` and process the request asynchronously. The persisted record SHALL have `source` equal to `manual_text`.

#### Scenario: Valid invitation is accepted for processing
- **WHEN** an authenticated candidate posts a non-empty `invitationText` within the length limit
- **THEN** the system responds `202` with a `jobId` and creates a `JobInvitation` with `source: "manual_text"`

#### Scenario: Missing or blank text is rejected
- **WHEN** the request omits `invitationText` or it is blank after trimming
- **THEN** the system responds `400` with a validation error and enqueues nothing

#### Scenario: Oversized text is rejected
- **WHEN** `invitationText` exceeds 5000 characters
- **THEN** the system responds `400` and enqueues nothing

#### Scenario: Unknown intent is rejected
- **WHEN** `intent` is not one of the allowed values
- **THEN** the system responds `400`

#### Scenario: Unauthenticated request is rejected
- **WHEN** the request carries no valid candidate credentials
- **THEN** the system responds `401`

### Requirement: Invitation Reply Draft Status Retrieval
The system SHALL expose `GET /invitations/reply-drafts/{jobId}` returning `status` (`processing`, `completed`, `failed`). While `processing` it SHALL include `phase` (`queued`, `parsing`, `drafting`, `saving`). When `completed` it SHALL include the parsed `invitation` and the `draftReply`, plus `durationMs`. When `failed` it SHALL include a user-facing error message and `durationMs`. A candidate SHALL only access their own jobs.

#### Scenario: Processing job reports its phase
- **WHEN** a client polls a job still running
- **THEN** the response has `status: "processing"` and the current `phase`

#### Scenario: Completed job returns parsed invitation and draft
- **WHEN** a client polls a finished job
- **THEN** the response has `status: "completed"`, `invitation`, `draftReply` and `durationMs`

#### Scenario: Failed job returns a user-facing error
- **WHEN** a client polls a job that failed
- **THEN** the response has `status: "failed"`, a user-facing message and `durationMs`

#### Scenario: Another candidate's job is not accessible
- **WHEN** a candidate polls a `jobId` belonging to a different candidate
- **THEN** the system responds `404`

### Requirement: Structured Invitation Extraction
The agent SHALL extract from the invitation text a structured object validated by a Pydantic schema with: `recruiterName`, `recruiterTitle`, `company`, `roleTitle`, `location`, `language`, and `callToAction`. Fields absent from the text SHALL be `null` rather than invented. Marketing taglines in the recruiter's signature SHALL NOT be treated as the recruiter's title or company. Free-form unvalidated output SHALL NOT be accepted; on validation failure the system SHALL retry once with a context-budget-capped prompt before failing the job.

#### Scenario: Reference Baxter invitation is parsed
- **WHEN** the reference invitation from Alexis Aguiñaga is submitted
- **THEN** the extraction yields `recruiterName: "Alexis Aguiñaga"`, `recruiterTitle: "Senior Talent Acquisition Consultant"`, `company: "Baxter International Inc."`, `roleTitle: "Business Intelligence Specialist"`, `location: "Bogotá, D.C."`, `language: "en"`

#### Scenario: Signature tagline is ignored
- **WHEN** the signature contains "This is where you can do your best work while helping save and sustain lives"
- **THEN** that tagline appears in none of the extracted fields

#### Scenario: Missing information stays null
- **WHEN** the invitation does not mention a location
- **THEN** `location` is `null`

#### Scenario: Invalid LLM output is retried once
- **WHEN** the first LLM output fails schema validation
- **THEN** the system retries once; if the retry also fails the job ends `failed`

#### Scenario: Diacritics are preserved
- **WHEN** the text contains characters such as `ñ` and `á`
- **THEN** they appear unchanged in the extracted fields and the persisted record

### Requirement: Grounded Draft Reply Generation
The agent SHALL generate a plain-text reply addressed to the recruiter by name, written in the invitation's `language`, shaped by `intent`, and grounded only in the invitation text and a bounded summary of the candidate's stored profile. The draft SHALL NOT state employers, skills, years of experience, salary expectations, notice period, or availability that are absent from the profile summary or invitation. The system SHALL NOT send the draft anywhere.

#### Scenario: Interested reply to the reference invitation
- **WHEN** the reference invitation is processed with `intent: "interested"` for a candidate whose profile lists Johnson & Johnson as a past employer
- **THEN** the draft is in English, greets "Alexis", thanks her, references the Business Intelligence Specialist role at Baxter, and proposes a conversation

#### Scenario: Request-more-info reply asks for missing details
- **WHEN** `intent` is `request_more_info`
- **THEN** the draft asks for the job description, compensation range, work modality and process steps, and does not express a commitment

#### Scenario: Decline reply is polite and non-committal
- **WHEN** `intent` is `decline`
- **THEN** the draft thanks the recruiter, declines the role, and leaves the door open for future opportunities

#### Scenario: No ungrounded facts
- **WHEN** a draft is generated for a profile that does not contain an employer or skill
- **THEN** the draft does not mention that employer or skill unless the invitation itself does

#### Scenario: Reply mirrors the invitation language
- **WHEN** the invitation is written in Spanish
- **THEN** the draft is written in Spanish

#### Scenario: Salary and availability are not invented
- **WHEN** the profile contains no salary or availability preference
- **THEN** the draft states neither

### Requirement: Invitation Persistence and Source Contract
The system SHALL persist each processed invitation as a `JobInvitation` containing `candidateId`, `source`, nullable `externalId`, `rawText`, parsed fields, `intent`, `draftReply`, and `status`. The pair `(candidateId, source, externalId)` SHALL be unique when `externalId` is non-null so future automated sources can be de-duplicated.

#### Scenario: Completed job is persisted
- **WHEN** a job completes
- **THEN** a `JobInvitation` exists with the raw text, parsed fields, intent and draft

#### Scenario: Manual submissions may repeat
- **WHEN** the same text is submitted twice manually (`externalId` null)
- **THEN** two separate records are created

#### Scenario: Automated duplicate is rejected by the uniqueness rule
- **WHEN** two records share `(candidateId, source, externalId)` with a non-null `externalId`
- **THEN** the database rejects the second

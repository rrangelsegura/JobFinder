## ADDED Requirements

### Requirement: Scheduled and On-Demand Checks
For each enabled monitor the system SHALL run a check at the configured frequency, and SHALL provide a "check now" action that runs one immediately. A check SHALL read only messages that arrived since the previous successful check, using the mailbox read-only, and SHALL never delete, move, or mark mailbox messages as read. A candidate SHALL NOT have two checks running at once.

#### Scenario: Recurring check runs at the configured frequency
- **WHEN** a monitor is enabled with a 60-minute frequency
- **THEN** a check runs about every 60 minutes

#### Scenario: Check now runs immediately
- **WHEN** the candidate triggers "check now" on an enabled monitor
- **THEN** a check starts without waiting for the schedule and reports its result

#### Scenario: Overlapping check is refused
- **WHEN** a check is already running for the candidate and another is requested
- **THEN** the second request is refused with `409` and no second check starts

#### Scenario: Mailbox is left untouched
- **WHEN** a check completes
- **THEN** no message in the mailbox was deleted, moved, flagged or marked as read

### Requirement: LinkedIn Message Detection
The system SHALL treat a mailbox message as a LinkedIn notification only if its sender address belongs to a `linkedin.com` domain and it passes the sender-authentication results recorded by the receiving mail server. All other messages SHALL be ignored and not stored. For each detected message the system SHALL keep the sender name, subject, received date, source kind (`linkedin_message` or `linkedin_notification`), and the message id as `externalId`.

#### Scenario: LinkedIn e-mail is detected
- **WHEN** a new e-mail from a LinkedIn notification address with passing authentication arrives
- **THEN** it is recorded as a detected notification with its message id

#### Scenario: Non-LinkedIn e-mail is ignored
- **WHEN** the mailbox contains e-mails from other senders
- **THEN** none is stored, read into the classifier, or counted

#### Scenario: Spoofed sender is ignored
- **WHEN** an e-mail claims a LinkedIn sender but fails sender authentication
- **THEN** it is ignored

### Requirement: De-duplication
The system SHALL record each LinkedIn message at most once per candidate, keyed by `(candidateId, source, externalId)`. Re-reading the same message in a later check SHALL NOT create a duplicate, re-classify it, or notify again.

#### Scenario: Same message seen twice
- **WHEN** two consecutive checks both see the same message id
- **THEN** one detected notification exists and only the first check notified about it

#### Scenario: First enable does not flood the candidate
- **WHEN** the monitor is enabled for the first time
- **THEN** only messages received from that moment on are processed, not the mailbox history

### Requirement: Data Minimization
The system SHALL store the message body only for items classified as `job_invitation`, truncated to 5000 characters. For every other category, and for `uncategorized`, the body SHALL be discarded after classification and only sender, subject, date, category and confidence retained.

#### Scenario: Social message body is not kept
- **WHEN** an item is classified `social_message`
- **THEN** no body text is stored for it

#### Scenario: Job invitation body is kept for drafting
- **WHEN** an item is classified `job_invitation`
- **THEN** its body, truncated to 5000 characters, is stored so a reply can be drafted

### Requirement: Check Result and Failure Handling
Every check SHALL record when it ran, how many messages it detected, and its outcome. A check that cannot reach the mailbox or authenticate SHALL fail without losing the previous cursor, so the next check re-reads the same period. After 3 consecutive failed checks the system SHALL set the connection to an error state, stop the schedule, and offer the candidate a reconnect; it SHALL NOT keep retrying indefinitely.

#### Scenario: Successful check is recorded
- **WHEN** a check finishes
- **THEN** the monitor shows the last check time, how many new items it found, and success

#### Scenario: Transient failure does not lose messages
- **WHEN** a check fails to connect and the next one succeeds
- **THEN** messages that arrived during the outage are detected by the later check

#### Scenario: Persistent failure stops the schedule
- **WHEN** 3 consecutive checks fail
- **THEN** the connection is marked as error, the schedule is removed, and the candidate sees a reconnect prompt

### Requirement: Reply Draft from a Detected Invitation
The system SHALL let the candidate start a reply draft from a detected `job_invitation`, reusing the existing reply-draft capability with the stored body as `invitationText`, the detection's `source`, and its `externalId`. Starting a draft for an item that is not a `job_invitation`, or whose body is no longer stored, SHALL be refused.

#### Scenario: Draft from a detected invitation
- **WHEN** the candidate requests a draft for a detected `job_invitation`
- **THEN** a reply-draft job is created with that item's source and externalId and the usual job id is returned

#### Scenario: Draft for another category is refused
- **WHEN** the candidate requests a draft for a `social_message`
- **THEN** the system responds `409`

#### Scenario: Another candidate's item is not accessible
- **WHEN** a candidate requests a draft for an item that belongs to someone else
- **THEN** the system responds `404`

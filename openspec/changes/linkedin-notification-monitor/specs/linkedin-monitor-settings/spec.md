## ADDED Requirements

### Requirement: Monitor Configuration
The system SHALL let an authenticated candidate read and update a single LinkedIn monitor configuration holding: `enabled`, `checkFrequencyMinutes`, an optional `linkedinProfileUrl`, and the mailbox connection. A new candidate has no configuration; reading it returns the defaults with `enabled: false`. The candidate is derived from the session, never from the request body.

#### Scenario: Defaults for a candidate who never configured the monitor
- **WHEN** an authenticated candidate reads the configuration for the first time
- **THEN** the system responds with `enabled: false`, `checkFrequencyMinutes: 1440`, no profile URL, and `mailbox.connected: false`

#### Scenario: Unauthenticated access is rejected
- **WHEN** a request carries no valid session
- **THEN** the system responds `401`

#### Scenario: Configuration is private to its owner
- **WHEN** a candidate reads or updates the configuration
- **THEN** only that candidate's own configuration is read or changed

### Requirement: Check Frequency
The system SHALL accept `checkFrequencyMinutes` only from the allowed set 15, 30, 60, 180, 360, 720, 1440 (default 1440). Any other value SHALL be rejected with `400` and the configuration left unchanged. Changing the frequency of an enabled monitor SHALL take effect for the next scheduled check without restarting the application.

#### Scenario: Valid frequency is saved
- **WHEN** the candidate sets `checkFrequencyMinutes` to 60
- **THEN** the system saves it and the next check is scheduled 60 minutes after the previous one

#### Scenario: Unsupported frequency is rejected
- **WHEN** the candidate sets `checkFrequencyMinutes` to 5 or to a non-integer
- **THEN** the system responds `400` and keeps the previous value

### Requirement: LinkedIn Profile URL
The system SHALL accept an optional `linkedinProfileUrl` that is an `https` URL on the `linkedin.com` domain whose path starts with `/in/`. It is an identity label only: the system SHALL NOT fetch or scrape it. An empty value clears it.

#### Scenario: Valid profile URL is stored
- **WHEN** the candidate saves `https://www.linkedin.com/in/some-person/`
- **THEN** the system stores it and does not make any request to LinkedIn

#### Scenario: Other URLs are rejected
- **WHEN** the candidate saves a URL that is not an https `linkedin.com/in/…` address
- **THEN** the system responds `400`

### Requirement: Mailbox Connection
The system SHALL let the candidate connect the mailbox that receives LinkedIn e-mail notifications by providing IMAP host, port, security mode, username and password (typically an app password). Before saving, the system SHALL test the connection (login and open the inbox read-only) and SHALL save it only if the test succeeds. A failed test SHALL return a user-facing reason (unreachable, authentication failed) and save nothing.

#### Scenario: Successful connection test saves the mailbox
- **WHEN** the candidate submits valid IMAP settings
- **THEN** the system verifies the login, saves the connection, and reports `mailbox.connected: true`

#### Scenario: Wrong password is not saved
- **WHEN** the IMAP server rejects the credentials
- **THEN** the system responds with an authentication-failed message and stores nothing

#### Scenario: Unreachable server is not saved
- **WHEN** the host cannot be reached within the timeout
- **THEN** the system responds with an unreachable message and stores nothing

#### Scenario: Disconnecting removes the credentials
- **WHEN** the candidate disconnects the mailbox
- **THEN** the stored credentials are deleted, the monitor is disabled, and its scheduled checks are removed

### Requirement: Credential Protection
The system SHALL store the mailbox password encrypted at rest and SHALL NOT return it, in any response or log line, after it is saved; responses expose only the host, port, username and `connected`. The system SHALL NOT ask for, accept, or store LinkedIn credentials.

#### Scenario: Password is never returned
- **WHEN** the candidate reads the configuration after saving a mailbox
- **THEN** the response contains host, port, security mode and username but no password or encrypted value

#### Scenario: Missing encryption key blocks saving
- **WHEN** the encryption secret is not configured
- **THEN** saving a mailbox responds `500` with a generic message and stores nothing

### Requirement: Enabling the Monitor
The system SHALL allow `enabled: true` only when a mailbox is connected. Enabling SHALL schedule the recurring check; disabling SHALL remove it. Enabling without a mailbox SHALL respond `409`.

#### Scenario: Enable with a connected mailbox
- **WHEN** the candidate enables the monitor and a mailbox is connected
- **THEN** the monitor is `enabled: true` and a recurring check is scheduled at the configured frequency

#### Scenario: Enable without a mailbox
- **WHEN** the candidate enables the monitor with no connected mailbox
- **THEN** the system responds `409` and the monitor stays disabled

#### Scenario: Disable stops checks
- **WHEN** the candidate disables the monitor
- **THEN** no further checks run for that candidate until it is enabled again

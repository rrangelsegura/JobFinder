## ADDED Requirements

### Requirement: Verified WhatsApp Opt-In
The system SHALL send WhatsApp alerts only to a number the candidate registered and verified. Registering a number in international format (E.164) SHALL send a 6-digit verification code through WhatsApp; the number SHALL be marked verified only when the candidate submits the correct, unexpired code (10 minutes, at most 5 attempts). Alerts SHALL never be sent to an unverified number.

#### Scenario: Valid number receives a code
- **WHEN** the candidate registers `+573001234567`
- **THEN** a verification code is sent to that number and the number is pending verification

#### Scenario: Correct code verifies the number
- **WHEN** the candidate submits the correct code within 10 minutes
- **THEN** the number becomes verified and alerts can be enabled

#### Scenario: Wrong or expired code is rejected
- **WHEN** the code is wrong, expired, or the 5-attempt limit is exceeded
- **THEN** the number stays unverified and the system asks for a new code

#### Scenario: Malformed number is rejected
- **WHEN** the candidate enters a number that is not valid E.164
- **THEN** the system responds `400` and sends nothing

#### Scenario: Changing the number resets verification
- **WHEN** the candidate changes their number
- **THEN** the new number is unverified and alerts stop until it is verified

### Requirement: Alert Preferences
The system SHALL let the candidate choose which categories trigger a WhatsApp alert: `job_invitation` (default on), `social_message` (default off), `sponsored_message` (default off). `uncategorized` items SHALL NOT trigger alerts. The candidate SHALL also be able to turn alerts off entirely without disconnecting the monitor.

#### Scenario: Default preferences
- **WHEN** a number is verified and preferences were never edited
- **THEN** only `job_invitation` items trigger alerts

#### Scenario: Social messages enabled
- **WHEN** the candidate enables `social_message` alerts
- **THEN** social messages detected afterwards are included in alerts

#### Scenario: Alerts off keeps detection on
- **WHEN** the candidate turns WhatsApp alerts off
- **THEN** checks and classification continue and items appear in the list, with no WhatsApp message sent

### Requirement: Summary Message per Check
After a check the system SHALL send at most one WhatsApp message, summarizing the new items whose category is enabled for alerts: counts per category and up to 5 items (sender and category). It SHALL NOT send anything when no alert-worthy item was found, and SHALL NOT send the same item twice. The message SHALL include a link to the detected-notifications page.

#### Scenario: New job invitation alerts the candidate
- **WHEN** a check finds one new `job_invitation` from Alexis Aguiñaga and alerts are on
- **THEN** one WhatsApp message mentions the job invitation, its sender, and the link

#### Scenario: Several items produce one message
- **WHEN** a check finds 3 job invitations and 2 social messages with both categories enabled
- **THEN** exactly one message is sent summarizing them

#### Scenario: Nothing alert-worthy
- **WHEN** a check finds only sponsored messages and sponsored alerts are off
- **THEN** no WhatsApp message is sent

#### Scenario: Already-notified items are not repeated
- **WHEN** a later check re-reads an item that was already alerted
- **THEN** it is not included again

### Requirement: Minimal Message Content
By default the WhatsApp message SHALL contain only the category, the sender's name and the link, and SHALL NOT contain the message text. The candidate MAY opt in to including a snippet of at most 80 characters, which SHALL only apply to `job_invitation` items.

#### Scenario: Default content has no message text
- **WHEN** an alert is sent with default settings
- **THEN** the message contains no part of the LinkedIn message body

#### Scenario: Snippet opt-in
- **WHEN** the candidate enables snippets and a job invitation is alerted
- **THEN** the message includes at most 80 characters of that invitation's text

### Requirement: Delivery Failure Handling
If WhatsApp delivery fails, the system SHALL keep the items marked as not yet notified and retry on the next check, SHALL NOT fail the check itself, and SHALL show the candidate a delivery-problem notice. After 3 consecutive delivery failures it SHALL stop attempting alerts until the candidate re-verifies the number.

#### Scenario: Transient delivery failure
- **WHEN** a send fails once and succeeds on the next check
- **THEN** the items are delivered then, once

#### Scenario: Persistent delivery failure
- **WHEN** 3 consecutive sends fail
- **THEN** alerts stop, the candidate sees a notice to re-verify the number, and detection continues

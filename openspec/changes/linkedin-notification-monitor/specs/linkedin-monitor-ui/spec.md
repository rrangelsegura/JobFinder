## ADDED Requirements

### Requirement: Monitor Settings Page
The frontend SHALL provide an authenticated "LinkedIn Monitor" settings page where the candidate can enter the optional profile URL, connect or disconnect the mailbox ("Test and save"), choose the check frequency, register and verify a WhatsApp number, set alert preferences, enable or disable the monitor, and trigger "Check now".

#### Scenario: Enable is blocked without a mailbox
- **WHEN** no mailbox is connected
- **THEN** the enable control is disabled with an explanation

#### Scenario: Passwords are never shown
- **WHEN** the page loads a saved mailbox
- **THEN** the password field is empty and shows only that a password is saved

#### Scenario: Connection test feedback
- **WHEN** the candidate presses "Test and save" with bad credentials
- **THEN** the page shows the authentication-failed message and keeps the form values except the password

### Requirement: Connection Method Disclosure
The page SHALL tell the candidate that JobFinder reads the LinkedIn e-mail notifications of the connected mailbox and never accesses LinkedIn itself, and that the mailbox is only read.

#### Scenario: Page explains the connection method
- **WHEN** the candidate opens the page without a connected mailbox
- **THEN** it explains that LinkedIn is not accessed directly and the mailbox is used instead

### Requirement: Monitor Status Display
The page SHALL show whether the monitor is enabled, the time of the last check, how many new items it found, the connection state, and the WhatsApp state (not set, pending verification, verified, delivery problem). A connection in error state SHALL show a reconnect prompt.

#### Scenario: Healthy monitor
- **WHEN** the last check succeeded
- **THEN** the page shows the last check time and the new item count

#### Scenario: Connection error
- **WHEN** the connection is in error state
- **THEN** the page shows a reconnect prompt and the monitor is shown as stopped

### Requirement: WhatsApp Verification Flow
The page SHALL let the candidate enter a number, request the code, and submit it, showing clear states for pending, verified, wrong code, and expired code.

#### Scenario: Successful verification
- **WHEN** the candidate enters the right code
- **THEN** the page shows the number as verified

#### Scenario: Wrong code
- **WHEN** the code is wrong
- **THEN** the page shows an error and lets the candidate retry or request a new code

### Requirement: Detected Notifications List
The frontend SHALL provide a "Detected notifications" page listing the candidate's detected items, newest first, showing sender, subject, received time, category (with a visible marker when it was manually set or is low-confidence/uncategorized) and whether a WhatsApp alert was sent. The list SHALL be filterable by category and SHALL let the candidate change an item's category. For `job_invitation` items it SHALL offer "Draft a reply".

#### Scenario: Filter by category
- **WHEN** the candidate filters by `job_invitation`
- **THEN** only job invitations are listed

#### Scenario: Change a category
- **WHEN** the candidate changes an item's category
- **THEN** the list shows the new category marked as manually set

#### Scenario: Draft a reply from the list
- **WHEN** the candidate chooses "Draft a reply" on a job invitation
- **THEN** the page starts the reply-draft job and shows its progress and result as in the Invitation Replies page

#### Scenario: Empty state
- **WHEN** nothing has been detected yet
- **THEN** the page explains that items appear after the first check and offers "Check now"

## ADDED Requirements

### Requirement: Candidate Registration
The system SHALL let a job seeker register with an email and password via `POST /auth/register`, hashing the password (bcrypt, cost factor 12) before storage, and SHALL reject a duplicate email with a clear `400` error.

#### Scenario: New candidate registers successfully
- **WHEN** a job seeker submits `POST /auth/register` with a valid, unused email and a password of at least 8 characters
- **THEN** the system creates a `Candidate` with a bcrypt-hashed password and responds `201` with `{ candidateId }`

#### Scenario: Duplicate email rejected
- **WHEN** a job seeker submits `POST /auth/register` with an email already registered to another `Candidate`
- **THEN** the system responds `400` with an "email already registered" error and does not create a new record

#### Scenario: Weak password rejected
- **WHEN** a job seeker submits `POST /auth/register` with a password shorter than 8 characters
- **THEN** the system responds `400` and does not create a `Candidate`

### Requirement: Placeholder Name Until CV Upload
Registration SHALL NOT require `firstName`/`lastName`. The system SHALL create the `Candidate` with placeholder name values, to be overwritten by the existing CV extraction pipeline once the candidate uploads a CV.

#### Scenario: New candidate has a placeholder name before uploading a CV
- **WHEN** a candidate registers via `POST /auth/register`
- **THEN** the created `Candidate` has non-empty placeholder `firstName`/`lastName` values, distinct from any real extracted name

### Requirement: CV Upload Reminder Email
The system SHALL send a single, one-shot reminder email to a newly registered candidate prompting them to upload their CV. It SHALL NOT retry or re-send this email on a schedule.

#### Scenario: Reminder sent once on successful registration
- **WHEN** `POST /auth/register` successfully creates a `Candidate`
- **THEN** the system sends exactly one email to that candidate's address prompting them to upload their CV

### Requirement: Candidate Login
The system SHALL authenticate a candidate via `POST /auth/login` with email and password, and on success SHALL create a server-side session (Redis-backed) and set an `httpOnly`, `secure`, `sameSite=lax` session cookie.

#### Scenario: Successful login
- **WHEN** a registered candidate submits `POST /auth/login` with their correct email and password
- **THEN** the system creates a Redis-backed session, sets the session cookie, and responds `200`

### Requirement: Generic Login Failure
The system SHALL reject incorrect login credentials with a single generic error, regardless of whether the email is unregistered or the password is wrong, to prevent account enumeration.

#### Scenario: Unknown email rejected generically
- **WHEN** `POST /auth/login` is submitted with an email that has no matching `Candidate`
- **THEN** the system responds `401` with the same generic `{ error: "Invalid email or password" }` used for a wrong password

#### Scenario: Wrong password rejected generically
- **WHEN** `POST /auth/login` is submitted with a registered email and an incorrect password
- **THEN** the system responds `401` with the same generic `{ error: "Invalid email or password" }` used for an unknown email

### Requirement: Session Persistence Across Reload
The system SHALL let a candidate's session survive a page reload or new tab: `GET /auth/session` SHALL return the current candidate's identity while the session cookie remains valid, without requiring the candidate to log in again.

#### Scenario: Session check succeeds with a valid cookie
- **WHEN** `GET /auth/session` is called with a valid, unexpired session cookie
- **THEN** the system responds `200` with `{ candidateId, email }`

#### Scenario: Session check fails without a valid cookie
- **WHEN** `GET /auth/session` is called with no session cookie, or one that is invalid or expired
- **THEN** the system responds `401`

### Requirement: Candidate Logout
The system SHALL let a candidate end their session via `POST /auth/logout`, immediately invalidating it server-side so the same cookie can never be reused.

#### Scenario: Logout invalidates the session immediately
- **WHEN** a logged-in candidate calls `POST /auth/logout`
- **THEN** the system deletes the Redis session record, clears the cookie, and responds `200`

#### Scenario: Session cookie is unusable after logout
- **WHEN** `GET /auth/session` is called with the same cookie that was just invalidated by `POST /auth/logout`
- **THEN** the system responds `401`

### Requirement: Password Storage Security
The system SHALL never store or log a candidate's password in plain text; only a bcrypt hash (cost factor 12) SHALL be persisted, and request/error logging SHALL NOT dump raw `/auth/*` request bodies.

#### Scenario: Stored password is a bcrypt hash
- **WHEN** a candidate registers
- **THEN** the persisted `Candidate.passwordHash` value is a bcrypt hash, and the plain-text password does not appear in the database or in application logs

### Requirement: Session-Based Route Protection
Any endpoint requiring authentication SHALL use the `requireAuth` middleware, which SHALL derive `candidateId` from the session server-side and reject the request with `401` before the route handler runs if no valid session exists. It SHALL NOT trust any client-supplied candidate identity.

#### Scenario: Valid session grants access
- **WHEN** a request to a protected endpoint includes a valid session cookie
- **THEN** `requireAuth` attaches `req.candidateId` derived from the session and calls `next()`

#### Scenario: Missing or invalid session denies access
- **WHEN** a request to a protected endpoint has no session cookie, or one that is invalid or expired
- **THEN** `requireAuth` responds `401` and the protected route handler never executes

### Requirement: Login Rate Limiting
The system SHALL rate-limit `POST /auth/login` (per-IP and/or per-email) to blunt brute-force credential-guessing attempts.

#### Scenario: Excessive login attempts are throttled
- **WHEN** a client exceeds the configured number of `POST /auth/login` attempts within the rate-limit window
- **THEN** the system rejects further attempts from that client until the window resets, without revealing whether any tried email is registered

# candidate-authentication Specification

## Purpose

Registration, login, logout, and session-check for candidates, backed by bcrypt password hashing and Redis-backed server-side sessions delivered via an httpOnly cookie — the identity layer every other candidate-facing capability (CV upload, workspace) is gated behind.

## Requirements

### Requirement: Candidate Registration
The system SHALL let a job seeker register with an email and password via `POST /auth/register`, hashing the password (bcrypt, cost factor 12) before storage, and SHALL reject a duplicate email with a clear `400` error. The created `Candidate` SHALL start with `emailVerifiedAt` unset (not yet verified), and the system SHALL generate a one-time verification token and send a verification email to the registered address.

#### Scenario: New candidate registers successfully
- **WHEN** a job seeker submits `POST /auth/register` with a valid, unused email and a password of at least 8 characters
- **THEN** the system creates a `Candidate` with a bcrypt-hashed password and `emailVerifiedAt` unset, responds `201` with `{ candidateId }`, and sends a verification email to that address

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
The system SHALL send a single, one-shot reminder email prompting a candidate to upload their CV once their email is verified, not at registration. It SHALL NOT retry or re-send this email on a schedule.

#### Scenario: Reminder sent once on successful verification
- **WHEN** a candidate's email is successfully verified via `POST /auth/verify-email`
- **THEN** the system sends exactly one email to that candidate's address prompting them to upload their CV

#### Scenario: Reminder not sent at registration
- **WHEN** `POST /auth/register` successfully creates a `Candidate`
- **THEN** the system does not send the CV-upload reminder email at that point — only the verification email

### Requirement: Candidate Login
The system SHALL authenticate a candidate via `POST /auth/login` with email and password, and on success SHALL create a server-side session (Redis-backed), set an `httpOnly`, `secure`, `sameSite=lax` session cookie, and respond with the candidate's current email-verification status — regardless of whether that email is verified yet.

#### Scenario: Successful login
- **WHEN** a registered candidate submits `POST /auth/login` with their correct email and password
- **THEN** the system creates a Redis-backed session, sets the session cookie, and responds `200` with `{ candidateId, email, emailVerified }`

#### Scenario: Login succeeds even when unverified
- **WHEN** a registered candidate with `emailVerifiedAt` unset submits `POST /auth/login` with their correct email and password
- **THEN** the system still creates a session and responds `200` with `emailVerified: false` — login itself is not blocked by verification status

### Requirement: Generic Login Failure
The system SHALL reject incorrect login credentials with a single generic error, regardless of whether the email is unregistered or the password is wrong, to prevent account enumeration.

#### Scenario: Unknown email rejected generically
- **WHEN** `POST /auth/login` is submitted with an email that has no matching `Candidate`
- **THEN** the system responds `401` with the same generic `{ error: "Invalid email or password" }` used for a wrong password

#### Scenario: Wrong password rejected generically
- **WHEN** `POST /auth/login` is submitted with a registered email and an incorrect password
- **THEN** the system responds `401` with the same generic `{ error: "Invalid email or password" }` used for an unknown email

### Requirement: Session Persistence Across Reload
The system SHALL let a candidate's session survive a page reload or new tab: `GET /auth/session` SHALL return the current candidate's identity and email-verification status while the session cookie remains valid, without requiring the candidate to log in again.

#### Scenario: Session check succeeds with a valid cookie
- **WHEN** `GET /auth/session` is called with a valid, unexpired session cookie
- **THEN** the system responds `200` with `{ candidateId, email, emailVerified }`

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
Any endpoint requiring authentication SHALL use the `requireAuth` middleware, which SHALL derive `candidateId` from the session server-side and reject the request with `401` before the route handler runs if no valid session exists. It SHALL NOT trust any client-supplied candidate identity. If a valid session exists but the candidate's email is not yet verified, `requireAuth` SHALL reject the request with `403` before the route handler runs, distinct from the `401` used for no/invalid session.

#### Scenario: Valid session grants access
- **WHEN** a request to a protected endpoint includes a valid session cookie for a verified candidate
- **THEN** `requireAuth` attaches `req.candidateId` derived from the session and calls `next()`

#### Scenario: Missing or invalid session denies access
- **WHEN** a request to a protected endpoint has no session cookie, or one that is invalid or expired
- **THEN** `requireAuth` responds `401` and the protected route handler never executes

#### Scenario: Valid session but unverified email denies access
- **WHEN** a request to a protected endpoint includes a valid session cookie for a candidate whose email is not yet verified
- **THEN** `requireAuth` responds `403` and the protected route handler never executes

### Requirement: Login Rate Limiting
The system SHALL rate-limit `POST /auth/login` (per-IP and/or per-email) to blunt brute-force credential-guessing attempts.

#### Scenario: Excessive login attempts are throttled
- **WHEN** a client exceeds the configured number of `POST /auth/login` attempts within the rate-limit window
- **THEN** the system rejects further attempts from that client until the window resets, without revealing whether any tried email is registered

### Requirement: Email Verification via One-Time Link
The system SHALL let a candidate verify their email via `POST /auth/verify-email` with a token, consuming the token (one-time use) and setting `Candidate.emailVerifiedAt` on success.

#### Scenario: Valid token verifies the email
- **WHEN** `POST /auth/verify-email` is called with a valid, unexpired, unused token
- **THEN** the system sets that candidate's `emailVerifiedAt`, invalidates the token so it cannot be reused, and responds `200`

#### Scenario: Expired or unknown token is rejected
- **WHEN** `POST /auth/verify-email` is called with a token that has expired, was already used, or does not exist
- **THEN** the system responds with an error and does not modify any candidate's `emailVerifiedAt`

### Requirement: Resend Verification Email
The system SHALL let an unverified candidate request a new verification email via `POST /auth/resend-verification`, identified by email address alone (no session required), rate-limited, and without revealing whether the given email is registered or already verified.

#### Scenario: Resend issues a new token for an unverified, registered email
- **WHEN** `POST /auth/resend-verification` is called with the email of a registered, unverified candidate
- **THEN** the system issues a new verification token (invalidating any prior one), sends a new verification email, and responds with a generic success message

#### Scenario: Resend does not reveal account existence or verification status
- **WHEN** `POST /auth/resend-verification` is called with an email that is unregistered, or already verified
- **THEN** the system responds with the same generic success message as a real, unverified account, without sending any email

#### Scenario: Excessive resend requests are throttled
- **WHEN** a client exceeds the configured number of `POST /auth/resend-verification` attempts within the rate-limit window
- **THEN** the system rejects further attempts from that client until the window resets

### Requirement: Real Email Delivery via Resend
The system SHALL send candidate-facing emails (verification, CV-upload reminder, extraction-failure acknowledgment) through a real email provider (Resend) rather than the local development-only mail catcher, in any environment configured to do so.

#### Scenario: Email is sent through the configured real provider
- **WHEN** the system sends any candidate-facing email in an environment configured with Resend credentials
- **THEN** the email is delivered via Resend rather than a local-only mail catcher

#### Scenario: Sandbox sender limits delivery until a domain is verified
- **WHEN** no custom domain has been verified in Resend and the system sends a candidate-facing email using the shared sandbox sender
- **THEN** delivery only succeeds for the Resend account owner's own address — this is a known, accepted limitation of the sandbox sender, not a defect

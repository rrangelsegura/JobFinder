## Why

System emails today go to `Candidate.email` — the address a candidate types in at registration — with no proof they actually own it. Separately, JobFinder has no real email delivery at all yet: `SMTP_HOST=localhost`/`SMTP_PORT=1025` points at MailDev, a local dev-only catch-all (intentional, not an oversight — it's why manual testing this project has done so far never spammed a real inbox). This change adds both: proof of email ownership, and the first real, production-facing email delivery this project has ever had.

## What Changes

- Add mandatory email verification: after registering, a candidate must click a link in a real email before they can use anything else in the app. Login still succeeds and creates a session (the password was correct — that's real authentication); the block is enforced server-side in `requireAuth` itself, so it automatically covers every current and future protected endpoint, not just the workspace UI.
- Verification tokens are Redis-backed opaque values (mirrors the existing `session.ts` pattern exactly — no new Postgres table), one-time use, ~24-48h TTL.
- New `Candidate.emailVerifiedAt: DateTime?` field — the first timestamp field `Candidate` will have.
- New endpoints: `POST /auth/verify-email` (consume token, mark verified) and `POST /auth/resend-verification` (no session required, rate-limited, anti-enumeration — same generic-response philosophy as login).
- **MODIFIED**: the CV-upload reminder email now fires on successful verification, not on registration — nagging a candidate to upload a CV they're currently blocked from uploading is bad UX.
- **MODIFIED**: `POST /auth/login` and `GET /auth/session` responses gain a verification-status field so the frontend can route accordingly.
- Replace MailDev with Resend as the real transport, via nodemailer's existing SMTP-relay support (keeps the current library, changes only the target).
- **Known, accepted limitation** (not fixed by this change): no verified custom domain exists yet, so Resend's shared sandbox sender is used — in that mode Resend only delivers to the Resend account owner's own address. Verifying a real domain is a separate, future change.

## Capabilities

### New Capabilities
_None._

### Modified Capabilities
- `candidate-authentication`: registration, login, session, and route-protection requirements gain the verification gate; the CV-upload-reminder trigger moves from registration to verification. **Note**: this capability's own change (`candidate-authentication`) is complete but not yet archived — there is no `openspec/specs/candidate-authentication/` yet to delta against on disk. This proposal's delta is written against that change's own (unarchived) spec content as the assumed baseline. `candidate-authentication` MUST be archived (syncing it to `openspec/specs/`) before or as part of implementing this change, the same blocking-order issue already hit once this session when archiving `cv-upload-hardening` (which needed `candidate-workspace` archived first).

## Impact

- **Backend**: `backend/api/lib/emailService.ts` (transport + new `sendVerificationEmail`), a new Redis-backed token module (mirrors `session.ts`), `backend/api/routes/auth.ts` (new endpoints, gated registration/CV-reminder timing), `backend/api/lib/rateLimiter.ts` (reused for resend), `requireAuth` middleware (verification check).
- **Schema**: `backend/prisma/schema.prisma` (`Candidate.emailVerifiedAt` + migration).
- **Infra/config**: `infra/docker-compose.yml` (remove `maildev` service once confirmed working), `backend/.env`/`backend/.env.example` (Resend config replaces MailDev defaults).
- **Frontend**: a new "verify your email" holding state/route (`LoginPage`/`RegisterPage`/workspace-routing-adjacent) for authenticated-but-unverified candidates.
- **Not in scope**: verifying a real custom domain in Resend (sandbox sender only, for now).

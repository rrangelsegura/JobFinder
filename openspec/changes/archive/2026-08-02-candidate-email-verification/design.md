## Context

Two existing system emails (`sendCvUploadReminderEmail`, `sendExtractionFailureEmail`) already send to `Candidate.email`, unverified, via MailDev (local dev-only). `candidate-authentication` deliberately keeps `Resume.extractedEmail` (CV-reported) separate from `Candidate.email` (login credential) — see its "Candidate Notified of Resume/Account Email Mismatch" requirement, which only shows a UI notice, never uses the CV email operationally. This change does not touch that separation; it only adds proof-of-ownership for `Candidate.email` itself.

`session.ts` already establishes the pattern this reuses: a Redis-backed opaque token (`randomUUID()`), namespaced key, `EX` TTL. `rateLimiter.ts` already establishes the pattern for anti-abuse (`checkLoginRateLimit`, dual IP+email dimensions). Neither needs to be invented, only extended.

No verified custom domain exists (`EMAIL_FROM`'s `jobfinder.dev` is a placeholder — no evidence of ownership), and no `FRONTEND_URL`-equivalent env var exists anywhere yet to build a verification link. This is genuinely the first production-facing infrastructure this project would have.

## Goals / Non-Goals

**Goals:**
- Prove a candidate owns `Candidate.email` before they can use the app.
- Replace MailDev with real delivery (Resend) for the emails this project already sends, plus the new verification email.
- Enforce the gate server-side, in one place (`requireAuth`), so it can't be bypassed by hitting an API directly.

**Non-Goals:**
- Verifying a real custom domain in Resend — sandbox sender only. Follow-up change.
- Touching the `Resume.extractedEmail` vs. `Candidate.email` separation — unrelated, already correctly designed.
- Password reset / "forgot password" flows — related shape (token + email) but a different capability, not bundled here.

## Decisions

**1. Verification tokens live in Redis, not Postgres** — identical shape to `session.ts`: `email-verify:<token>` → `{candidateId}`, `EX` TTL. Consistent with the codebase's existing choice for exactly this kind of "opaque, expiring, single-purpose credential," avoids a table that needs its own expiry cleanup.

**2. Gate is enforced inside `requireAuth`, not per-route.** A valid session with `emailVerifiedAt IS NULL` gets `403` (not `401` — `401` stays reserved for "no valid session at all," consistent with `candidate-authentication`'s existing use of `401` for that case; `403` correctly signals "I know who you are, you're just not allowed yet"). Every endpoint that already calls `requireAuth` — today's workspace/upload routes and any future protected endpoint — inherits the gate automatically, with no per-route change needed and no way to bypass it by calling an API directly instead of going through the frontend's routing.

**3. Login and session-check responses gain a verification-status field.** The frontend needs to know whether to route an authenticated candidate to the workspace or to a "verify your email" holding page. Since login itself still succeeds regardless of verification status (Decision 2 handles the actual blocking), the response body is the natural place to carry this.

**4. The CV-upload-reminder email moves from "on registration" to "on verification."** Today it fires immediately at registration. Once registration is gated behind verification, sending "go upload your CV" to someone who is currently blocked from uploading anything is actively confusing. Firing it from the verification handler instead keeps the reminder meaningful.

**5. Resend via nodemailer's SMTP relay, not the dedicated `resend` SDK.** Nodemailer is already wired into `emailService.ts`; Resend supports SMTP relay, so this becomes an env-var change (host/port/auth) rather than a library swap — smaller surface area for a change that's already touching a lot of surface (auth gating + new endpoints + provider swap).

## Risks / Trade-offs

- **[Risk]** Resend's sandbox sender only delivers to the Resend account owner's own address — no other candidate can actually receive a verification email until a real domain is verified → **Mitigation**: documented as an explicit, accepted limitation (see Open Question below for how this should shape local dev config); not silently discovered later.
- **[Risk]** Gating registration behind email ownership, with no real domain yet, means **no candidate other than the Resend account owner can complete registration at all** while in sandbox mode → **Mitigation**: acceptable for the project's current stage (no real users yet), but must be called out loudly — this is a hard product-usability ceiling until a domain is verified, not a minor caveat.
- **[Trade-off]** Baking the check into `requireAuth` is simpler and safer (Decision 2) but means every protected route now has a hard dependency on `emailVerifiedAt` being set correctly — a bug in the verification-write path fails closed (blocks legitimate verified candidates) rather than failing open, which is the right direction for a security-relevant gate but worth knowing going in.

## Migration Plan

1. Add `Candidate.emailVerifiedAt` via an additive migration (nullable, no backfill needed — existing test candidates simply start unverified).
2. Ship backend changes (token module, endpoints, `requireAuth` gate, email transport swap) together — the gate and the verification flow that satisfies it must land in the same deploy.
3. Ship the frontend "verify your email" holding state in the same deploy as the backend gate (an unhandled `403` with no frontend state to catch it is a broken login experience).
4. Once confirmed working end-to-end, remove `maildev` from `infra/docker-compose.yml` and its env defaults.
5. Rollback: additive schema change, safe to revert code without a down-migration; existing (test) candidates would simply become unverified again under old code, which doesn't enforce the gate anyway.

## Open Questions

- **Does local development keep using MailDev, with Resend reserved for a real deployed environment?** Not decided during exploration — the sandbox-domain limitation (Risk above) means day-to-day local dev/testing would otherwise be gated by "only the Resend account owner's email can verify," which would break the kind of manual verification workflow this project has relied on all along (registering fresh throwaway test candidates). Needs a real decision — likely env-driven (MailDev locally by default, Resend in any deployed environment) — before or during implementation, not silently defaulted.

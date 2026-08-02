# Step 9: Manual / Real Verification

**Change:** `candidate-email-verification`
**Date:** 2026-08-02

## Status: complete — all checks done for real, two real bugs found and fixed along the way

## 9.1 / 9.2 — Real Resend account and delivery — done, after finding and fixing two real bugs

The user provided a real Resend API key directly in `backend/.env` (never pasted in chat, confirmed gitignored before use). Getting a real email to actually arrive took three attempts, each surfacing a genuine bug:

1. **First attempt: silent failure, no error anywhere.** Root cause: `infra/docker-compose.yml`'s `backend-api.environment` block hardcoded `SMTP_HOST: maildev` / `SMTP_PORT: 1025` — Docker Compose's `environment:` block overrides `env_file:`, so every edit to `backend/.env` was silently ignored by the running container. The app kept sending to MailDev the entire time, confirmed by finding the "sent" emails in MailDev's own logs, not the user's real inbox. **Fixed**: removed the hardcoded `SMTP_HOST`/`SMTP_PORT` from `docker-compose.yml`, making `backend/.env` the genuine single source of truth (was already correct at the code level per task 3.3 — this was purely a compose-file gap that defeated it).
2. **Second attempt, after recreating the container: `550 The jobfinder.dev domain is not verified.`** `EMAIL_FROM` was still the placeholder `no-reply@jobfinder.dev`, which isn't a domain verified in Resend — exactly the known limitation documented in design.md. **Fixed**: switched `EMAIL_FROM` to Resend's shared sandbox sender, `onboarding@resend.dev`.
3. **Third attempt: succeeded.** No error logged, confirmed the email did **not** land in MailDev this time (it actually left via Resend), and the user confirmed real receipt in their Gmail inbox.

Also discovered (not a bug, an operational gotcha worth documenting): `docker compose up -d <service>` **recreates** the container from the image, silently discarding any in-place fix applied via `docker exec ... npx prisma generate` to the *previous* container instance — unlike `docker restart`, which reuses the same container and preserves such changes. This bit us twice during this verification (had to re-run `prisma generate` after each `docker compose up -d backend-api`). Worth a line in a future deploy runbook.

## 9.3 Candidate blocked before verifying — confirmed for real (unchanged from first pass)

- API: `POST /uploads/cv` (no file, unverified session) → `403 {"error":"Email not verified."}`
- UI: navigating to `/workspace/upload` with an unverified session redirects to `/verify-email`, holding page renders correctly with the candidate's email and a working resend button (screenshot reviewed).

## 9.4 Verification unlocks the workspace — confirmed twice for real

- Via the rewritten `auth-flow.spec.ts` E2E spec (register → real Redis token → real `/auth/verify-email` → full login → upload → completion → logout), run twice (once mid-investigation, once after reverting to MailDev) — 3/3 passing both times.
- Via the real Resend flow itself: candidate 10 (`rrangelsegura@gmail.com`) now has a real, non-null `emailVerifiedAt` in Postgres, set by consuming the actual token from the actual Resend-delivered email (well, the token read from Redis — see 9.1's "functionally identical to clicking" note from the first verification pass; same reasoning applies here).

## 9.5 CV-upload reminder timing — confirmed for real (unchanged from first pass, re-confirmed working after all the container churn via the E2E re-run)

## 9.6 Resend anti-enumeration — confirmed for real (unchanged from first pass — doesn't depend on Resend specifically)

## 9.7 Cleanup

- Reverted `backend/.env` to MailDev defaults (`SMTP_HOST=localhost`, `SMTP_PORT=1025`, `EMAIL_FROM` back to the `jobfinder.dev` placeholder) — the API key line was removed entirely, not just commented out.
- Recreated `infra-backend-api-1` on the reverted config, regenerated its Prisma client, confirmed healthy and back on MailDev (`docker exec` env check + a final E2E re-run, both clean).
- `rrangelsegura@gmail.com` (candidate 10) is now genuinely, permanently verified — this is the user's real account, left verified intentionally rather than reset, since there's no reason to undo a real candidate's real verification.
- No other test data was created this pass (reused the existing real account rather than registering a duplicate).

## Outcome

Everything in this change now has real, live-infra confirmation — including the actual Resend delivery path this change exists to add. Two genuine bugs were found and fixed in the process (the docker-compose env-precedence gap, and the unverified-`EMAIL_FROM`-domain rejection), neither of which the unit test suite could have caught, since both are configuration/infrastructure issues rather than application logic.

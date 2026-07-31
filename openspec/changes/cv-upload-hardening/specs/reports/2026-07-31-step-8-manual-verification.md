# Step 8: Manual / Real Verification

**Change:** `cv-upload-hardening`
**Date:** 2026-07-31 (continuation of a session started 2026-07-30 that was interrupted mid-verification)

## 8.1 Rebuild and restart

`infra-backend-api-1` and `infra-backend-agent-1` were restarted multiple times during the debugging that happened before this continuation (dev-mode containers with bind-mounted source and `ts-node-dev --respawn`, so restarts pick up code changes without an image rebuild). Confirmed both containers were running the current code before re-verifying.

## 8.2 / 8.3 Re-upload the real CV — failure mode found and fixed

Re-uploading the real 5-page CV surfaced a genuine, previously-unseen failure: `WorkExperience.description` was `VarChar(200)` (sized for synthetic test fixtures), and a real job description exceeded it, crashing the persistence transaction with:

```
Invalid `prisma.workExperience.createMany()` invocation
The provided value for the column is too long for the column's type.
```

Fix: widened the column to unbounded `TEXT` via migration `20260731011544_widen_work_experience_description` (see `backend/prisma/schema.prisma` comment on `WorkExperience.description`).

Separately, `frontend/e2e/_manual-verification.spec.ts` — the Playwright script written to drive this verification — was timing out at 90s (`page.waitForFunction` and the suite's global `playwright.config.ts` timeout were both 90s, and the real OCR + local-LLM pipeline took longer than that on a cold run). Fixed by giving this one script its own generous budget (`test.setTimeout(300_000)`, wait raised to 270s) instead of touching the shared 90s default used by the rest of the suite. Re-ran after the fix:

```
RESULT email: hardening-verify-1785468556157@example.com
RESULT isSuccess: true
RESULT isFailure: false
RESULT successText: Your CV was processed successfully.
1 passed (2.5m)
```

Real wall-clock time for the full pipeline (OCR + LLM extraction with `num_ctx: 8192`, including one internal retry in some runs): ~2.4 minutes.

## 8.4 Verify persistence in Postgres

Confirmed directly in `jobfinder` (via `docker exec infra-postgres-1 psql`):

- `resumes` row for the passing e2e run (candidate 16): `extractedFirstName="Rene"`, `extractedLastName="Alejandro Rangel Segura"`, `extractedEmail="rrangelsegura@gmail.com"` — correctly separated from the login candidate record per `candidate-authentication`'s identity model.
- 8 `work_experiences` rows persisted for that candidate with no length-cap failure, confirming the `TEXT` migration actually fixed the crash (not just theoretically).
- An earlier run from the interrupted session (candidate 15, resume 13) had already independently confirmed the same fix before this continuation.

## 8.5 Failure acknowledgment email — exactly once per failure

Rather than construct a synthetic failure, used the real failures already produced while diagnosing 8.2/8.3 as evidence (`docker logs infra-backend-api-1` cross-referenced with `docker logs infra-maildev-1`):

| Job | Failure | Email sent (maildev) |
|---|---|---|
| 9  | LLM schema validation, 13 errors | ✅ 00:30:45 |
| 10 | agent responded 500 | ✅ 00:48:09 |
| 11 | LLM schema validation, 12 errors | ✅ 00:55:29 |
| 12 | `VarChar(200)` persistence crash (the bug fixed in 8.2/8.3) | ✅ 01:07:03 |

4 failures → 4 emails, all subject `"We hit a problem processing your CV"`, 1:1 with no duplicates and no drops. Body copy confirmed to not suggest the candidate try again immediately (it says JobFinder will email them once the underlying bug is fixed) — consistent with the honest-messaging requirement from step 5.

One earlier failure (job 8, 22:53:03) produced no email — traced to the dev server having restarted at 23:39:17, *after* that failure, meaning job 8 ran under an older build that predated the wiring of `handleExtractionJobFailure`. Not a regression: every failure that occurred once the current code was actually running produced exactly one email.

Note: `infra-maildev-1` shows as `unhealthy` in `docker ps` — this is a false positive from `docker-compose.yml`'s healthcheck referencing `${MAILDEV_WEB_PORT}`/`${MAILDEV_BASE_PATHNAME}`, which aren't set as environment variables anywhere, so the healthcheck probes the wrong URL (`http://localhost/api/healthz` instead of `:1080`). The service itself is fully functional (`curl http://localhost:1080/api/healthz` → `true`; SMTP delivery confirmed above). Not in scope for this change; flagging for a separate fix.

## 8.6 Visual confirmation of Shadcn inputs

Screenshotted `/login`, `/register`, and (authenticated) `/workspace/upload` against the dev server. All three show bordered, rounded Shadcn `Input` fields inside `Card`/`CardHeader`/`CardContent`, not raw unstyled `<input>` elements — including the file input on the upload form.

## 8.7 Cleanup

Deleted the synthetic test candidates created during verification (`hardening-verify-*@example.com`, ids 15 and 16) and their cascaded `resumes`/`work_experiences`/`educations`/`skills`/`languages`/`certifications` rows directly via SQL (no `onDelete` cascade defined in the schema, so children were deleted explicitly before the candidate row).

**Left untouched:** candidate id 10 (`rrangelsegura@gmail.com`) — this is the real account used for earlier real-world testing, not synthetic test data, and was not part of this cleanup.

## Outcome

The real bug this step was meant to catch (`VarChar(200)` too narrow for a real CV) was found and fixed. Extraction of the actual real-world CV now succeeds end-to-end and persists correctly. The failure-email path was verified with exactly 1:1 correspondence using real failures. All three forms visually confirmed to use Shadcn `Input`. No blockers remain for step 8.

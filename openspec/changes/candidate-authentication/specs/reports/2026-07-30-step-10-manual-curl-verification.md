# Step 10: Manual Endpoint Testing with curl

**Change:** `candidate-authentication`
**Date:** 2026-07-30
**Environment:** `infra/docker-compose.yml` (rebuilt `backend-api` with new deps — `ioredis`, `bcrypt`, `cookie-parser`, `nodemailer` — plus new `maildev` service).

## Setup

```bash
docker compose up -d maildev
docker compose build backend-api
docker compose up -d backend-api
```

## POST /auth/register

**Success:**
```bash
curl -s -X POST http://localhost:3000/auth/register -H "Content-Type: application/json" \
  -d '{"email":"e2e-curl@example.com","password":"supersecret"}'
# {"status":"success","data":{"candidateId":2},"agent_trace_id":"...","model_used":null}
```
Verified directly in Postgres: `firstName='New'`, `lastName='Candidate'` (placeholder, per design.md Decision 5), `passwordHash` starts with `$2b$12$...` (bcrypt, cost 12) — never plain text.

Verified the reminder email was actually sent (not mocked) — `docker logs infra-maildev-1`:
```
2026-07-30 21:34:39 Received: no-reply@jobfinder.dev -> e2e-curl@example.com
  Subject: Upload your CV to get started on JobFinder
```

**Duplicate email:**
```bash
curl -s -i -X POST http://localhost:3000/auth/register -H "Content-Type: application/json" \
  -d '{"email":"e2e-curl@example.com","password":"anotherpassword"}'
# HTTP/1.1 400 Bad Request
# {"status":"error","data":{"error":"Email already registered."}}
```

## POST /auth/login

**Success** (captured `Set-Cookie`):
```
Set-Cookie: jobfinder_session=d57c32a7-...; Max-Age=604800; Path=/; HttpOnly; SameSite=Lax
{"status":"success","data":{"candidateId":2,"email":"e2e-curl@example.com"},...}
```

**Unknown email vs. wrong password — identical generic error:**
```bash
curl -s -X POST http://localhost:3000/auth/login -d '{"email":"nobody@example.com","password":"whatever123"}'
# {"status":"error","data":{"error":"Invalid email or password"},...}
curl -s -X POST http://localhost:3000/auth/login -d '{"email":"e2e-curl@example.com","password":"wrongpassword"}'
# {"status":"error","data":{"error":"Invalid email or password"},...}
```
Both responses' `data.error` are byte-identical.

## GET /auth/session

- With the cookie: `200 {"candidateId":2,"email":"e2e-curl@example.com"}`
- Without a cookie: `401 {"status":"error","data":{"error":"Not authenticated."}}`

## POST /uploads/cv (real PDF, no `candidateId` in the body)

**Without a session — 401, no ECONNRESET:**
```bash
curl -s -i -X POST http://localhost:3000/uploads/cv -F "file=@golden-02-turing.pdf"
# HTTP/1.1 401 Unauthorized
```
This is the exact real bug this change's own TDD (task 6) found and fixed — `requireAuth` rejecting before the multipart body drains — confirmed fixed against the live server, not just mocked tests.

**With the session cookie — 202, candidateId derived server-side:**
```bash
curl -s -i -b cookies.txt -X POST http://localhost:3000/uploads/cv -F "file=@golden-02-turing.pdf"
# HTTP/1.1 202 Accepted
# {"status":"success","data":{"resumeId":4,"jobId":"4","status":"processing"},...}
```
Verified in Postgres: `resumes.candidateId = 2` — matches the session's candidate, never sent in the request body at all.

## POST /auth/logout

```bash
curl -s -i -b cookies.txt -c cookies.txt -X POST http://localhost:3000/auth/logout
# HTTP/1.1 200 OK
# Set-Cookie: jobfinder_session=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax
```

**The original session id itself is dead server-side** (not just client-cleared) — retried with the raw pre-logout session id explicitly:
```bash
curl -s -i -H "Cookie: jobfinder_session=d57c32a7-c6f6-4bb0-88c7-2eb4504140c7" http://localhost:3000/auth/session
# HTTP/1.1 401 Unauthorized
```

## Cleanup

Deleted the test candidate (id 2) and its cascaded resume row directly in Postgres. `candidates` count confirmed back to 0 (baseline) after cleanup.

## Outcome

All endpoints behave per spec against the real, running stack (real Postgres, real Redis, real SMTP via maildev, real bcrypt hashing, real PDF). No mocks involved in this step. One pre-existing-class bug (ECONNRESET on early rejection of a multipart request) was caught and fixed during TDD (Group 6) and re-confirmed fixed here against the live server.

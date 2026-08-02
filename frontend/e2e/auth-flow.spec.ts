import path from "node:path"
import { test, expect, request as playwrightRequest } from "@playwright/test"
import { Redis } from "ioredis"

// Real end-to-end run against the live infra/docker-compose.yml stack
// (backend-api, backend-agent, postgres, redis, maildev) — no mocks.
// `useSession()` now defaults to `live` (design.md Decision 4), so this
// supersedes candidate-workspace's mock-adapter version of the same
// scenario: that one could only prove the frontend renders correctly
// against a canned session; this one proves register -> verify -> login ->
// a real session cookie -> protected route -> upload -> extraction
// actually work together for a real candidate.
const GOLDEN_CV = path.resolve(
  import.meta.dirname,
  "../../openspec/changes/archive/2026-07-30-parse-candidate-cv/specs/reports/golden-dataset/golden-03-hopper.pdf",
)

const API_BASE_URL = process.env.VITE_API_BASE_URL ?? "http://localhost:3000"

function uniqueEmail() {
  return `e2e-${Date.now()}@example.com`
}

// candidate-email-verification: the real flow is "click the link in the
// email", but parsing MailDev's own UI/API to extract that link is a
// tangent to what this test proves (the auth/verification gate, not email
// deliverability — that's already covered by emailService.test.ts's unit
// test asserting the link is in the email body). Reading the token directly
// from the same Redis store the backend itself writes it to is the
// pragmatic equivalent: still the real backend, real token, real
// /verify-email endpoint — just without simulating an email client.
async function fetchVerificationTokenFor(candidateId: number): Promise<string> {
  const redis = new Redis({
    host: process.env.REDIS_HOST ?? "localhost",
    port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379,
  })
  try {
    const token = await redis.get(`email-verify-candidate:${candidateId}`)
    if (!token) {
      throw new Error(`No pending verification token found for candidate ${candidateId}`)
    }
    return token
  } finally {
    redis.disconnect()
  }
}

async function registerAndVerify(email: string, password: string): Promise<void> {
  const api = await playwrightRequest.newContext({ baseURL: API_BASE_URL })
  const registerRes = await api.post("/auth/register", { data: { email, password } })
  const { candidateId } = (await registerRes.json()).data as { candidateId: number }

  const token = await fetchVerificationTokenFor(candidateId)
  const verifyRes = await api.post("/auth/verify-email", { data: { token } })
  if (!verifyRes.ok()) {
    throw new Error(`Failed to verify email for candidate ${candidateId}: ${verifyRes.status()}`)
  }
  await api.dispose()
}

test("register, verify, log in, upload a real PDF through to completion, then log out", async ({
  page,
}) => {
  const email = uniqueEmail()
  const password = "supersecret"

  // Registration itself (the RegisterPage form) is already covered at the
  // component level by RegisterPage.test.tsx. Doing it via the real API here
  // (rather than driving the browser form) is what makes it possible to
  // learn the candidateId needed to fetch the verification token — see
  // registerAndVerify's comment above for why Redis, not a parsed email.
  await registerAndVerify(email, password)

  await page.goto("/login")
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/password/i).fill(password)
  await page.getByRole("button", { name: /log in/i }).click()

  await expect(
    page.getByRole("heading", { name: /upload your cv/i }),
  ).toBeVisible()

  await page.getByLabel(/cv/i).setInputFiles(GOLDEN_CV)
  await page.getByRole("button", { name: /upload/i }).click()

  await expect(page.getByRole("status")).toHaveText(/processing/i, {
    timeout: 10_000,
  })
  await expect(page.getByRole("status")).toHaveText(/success|complete/i, {
    timeout: 60_000,
  })

  // specs/candidate-authentication/spec.md "Logout invalidates the session
  // immediately"
  await page.getByRole("button", { name: /log out/i }).click()
  await expect(page).toHaveURL(/\/login/)

  await page.goto("/workspace/upload")
  await expect(page).toHaveURL(/\/login/)
})

test("wrong password shows the generic error, not an enumeration-revealing detail", async ({
  page,
}) => {
  await page.goto("/login")
  await page.getByLabel(/email/i).fill("nobody-e2e@example.com")
  await page.getByLabel(/password/i).fill("whatever-password")
  await page.getByRole("button", { name: /log in/i }).click()

  await expect(page.getByRole("alert")).toHaveText("Invalid email or password")
})

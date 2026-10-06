import path from "node:path"
import { readFileSync } from "node:fs"
import { test, expect, request as playwrightRequest } from "@playwright/test"
import { Redis } from "ioredis"

// Real end-to-end run against the live stack (Node API, Python agent,
// Postgres, Redis, local LLM) — no mocks. Same setup strategy as
// auth-flow.spec.ts: register through the API, read the verification token
// from the same Redis store the backend writes it to, then drive the real UI.
const BAXTER_INVITATION = readFileSync(
  path.resolve(
    import.meta.dirname,
    "../../backend/agents/invitation_responder/tests/fixtures/baxter_invitation.txt",
  ),
  "utf-8",
)

const API_BASE_URL = process.env.VITE_API_BASE_URL ?? "http://localhost:3000"

async function registerAndVerify(email: string, password: string) {
  const api = await playwrightRequest.newContext({ baseURL: API_BASE_URL })
  const registerRes = await api.post("/auth/register", {
    data: { email, password },
  })
  const { candidateId } = (await registerRes.json()).data as {
    candidateId: number
  }

  const redis = new Redis({
    host: process.env.REDIS_HOST ?? "localhost",
    port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379,
  })
  try {
    const token = await redis.get(`email-verify-candidate:${candidateId}`)
    if (!token) throw new Error(`No verification token for ${candidateId}`)
    const verifyRes = await api.post("/auth/verify-email", { data: { token } })
    if (!verifyRes.ok()) throw new Error(`Verify failed: ${verifyRes.status()}`)
  } finally {
    redis.disconnect()
    await api.dispose()
  }
}

async function logIn(page: import("@playwright/test").Page) {
  const email = `e2e-invitation-${Date.now()}@example.com`
  const password = "supersecret"
  await registerAndVerify(email, password)
  await page.goto("/login")
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/password/i).fill(password)
  await page.getByRole("button", { name: /log in/i }).click()
  await expect(
    page.getByRole("heading", { name: /upload your cv/i }),
  ).toBeVisible()
}

test.use({ permissions: ["clipboard-read", "clipboard-write"] })

test("paste the Baxter invitation, get a draft reply, copy it", async ({
  page,
}) => {
  await logIn(page)

  await page.getByRole("link", { name: "Invitation Replies" }).click()
  await expect(
    page.getByRole("heading", { name: /reply to a job invitation/i }),
  ).toBeVisible()

  // Submit is disabled until there is text.
  const submit = page.getByRole("button", { name: /draft a reply/i })
  await expect(submit).toBeDisabled()

  await page.getByLabel(/invitation text/i).fill(BAXTER_INVITATION)
  await expect(submit).toBeEnabled()
  await submit.click()

  // The completed state: parsed summary + read-only draft + "not sent" notice.
  const draft = page.getByLabel(/draft reply/i)
  await expect(draft).toBeVisible({ timeout: 60_000 })
  await expect(draft).toHaveAttribute("readonly", "")
  await expect(page.getByText("Alexis Aguiñaga", { exact: true })).toBeVisible()
  await expect(
    page.getByText("Baxter International Inc.", { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByText("Business Intelligence Specialist", { exact: true }),
  ).toBeVisible()
  await expect(page.getByText("Bogotá, D.C.", { exact: true })).toBeVisible()
  await expect(page.getByText(/has not been sent/i)).toBeVisible()
  await expect(draft).toHaveValue(/Alexis/)

  if (process.env.E2E_SCREENSHOT_PATH) {
    await page.screenshot({
      path: process.env.E2E_SCREENSHOT_PATH,
      fullPage: true,
    })
  }

  await page.getByRole("button", { name: "Copy" }).click()
  await expect(page.getByText(/copied to clipboard/i)).toBeVisible()
  const clipboard = await page.evaluate(() => navigator.clipboard.readText())
  expect(clipboard).toBe(await draft.inputValue())

  // Start over returns to an empty form.
  await page.getByRole("button", { name: /new invitation/i }).click()
  await expect(page.getByLabel(/invitation text/i)).toHaveValue("")
})

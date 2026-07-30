import path from "node:path"
import { test, expect } from "@playwright/test"

// Real end-to-end run against the live infra/docker-compose.yml stack
// (backend-api, backend-agent, postgres, redis, maildev) — no mocks.
// `useSession()` now defaults to `live` (design.md Decision 4), so this
// supersedes candidate-workspace's mock-adapter version of the same
// scenario: that one could only prove the frontend renders correctly
// against a canned session; this one proves register -> login -> a real
// session cookie -> protected route -> upload -> extraction actually work
// together for a real candidate.
const GOLDEN_CV = path.resolve(
  import.meta.dirname,
  "../../openspec/changes/archive/2026-07-30-parse-candidate-cv/specs/reports/golden-dataset/golden-03-hopper.pdf",
)

function uniqueEmail() {
  return `e2e-${Date.now()}@example.com`
}

test("register, log in, upload a real PDF through to completion, then log out", async ({
  page,
}) => {
  const email = uniqueEmail()
  const password = "supersecret"

  await page.goto("/register")
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/password/i).fill(password)
  await page.getByRole("button", { name: /register/i }).click()

  await expect(page).toHaveURL(/\/login/)

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

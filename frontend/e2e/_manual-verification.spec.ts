import { test, expect } from "@playwright/test"

const REAL_CV = "C:/Users/Usuario/AppData/Local/Temp/claude/C--Users-Usuario-Documents-RENE-Laboral-iniciativas-SistemasMultiagente-JobFinder-JobFinder/bdd4b61a-d5aa-4598-85a6-066a2101d4db/scratchpad/real-cv-rene.pdf"

function uniqueEmail() {
  return `hardening-verify-${Date.now()}@example.com`
}

test("re-upload the same real CV that originally failed extraction", async ({
  page,
}) => {
  // Overrides the suite's 90s default (playwright.config.ts) — the previous
  // run of this exact test hit that global timeout mid-wait even though the
  // backend went on to complete the extraction. This script is a one-off
  // manual-verification tool, not part of the fast regular e2e suite, so a
  // generous budget here doesn't slow anything else down.
  test.setTimeout(300_000)

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

  await page.getByLabel(/cv/i).setInputFiles(REAL_CV)
  await page.getByRole("button", { name: /upload/i }).click()

  await expect(page.getByRole("status")).toHaveText(/processing/i, {
    timeout: 10_000,
  })

  // Don't assume success — record whatever actually happens, up to 270s
  // (real OCR + local LLM, now with num_ctx: 8192; leaves 30s of the 300s
  // test budget for the steps before/after this wait).
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[role="status"], [role="alert"]')
      return el && !el.textContent?.toLowerCase().includes("processing")
    },
    { timeout: 270_000 },
  )

  const statusEl = page.getByRole("status")
  const alertEl = page.getByRole("alert")
  const isSuccess = await statusEl.isVisible().catch(() => false)
  const isFailure = await alertEl.isVisible().catch(() => false)

  console.log("RESULT email:", email)
  console.log("RESULT isSuccess:", isSuccess)
  console.log("RESULT isFailure:", isFailure)
  if (isSuccess) console.log("RESULT successText:", await statusEl.textContent())
  if (isFailure) console.log("RESULT failureText:", await alertEl.textContent())
})

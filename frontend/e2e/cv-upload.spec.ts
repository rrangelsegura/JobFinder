import path from "node:path"
import { test, expect } from "@playwright/test"

// Real end-to-end run against the live infra/docker-compose.yml stack
// (backend-api, backend-agent, Postgres, Redis, Chroma) using the mock auth
// adapter (design.md Decision 1) and a real PDF from the golden dataset
// proven to extract successfully in parse-candidate-cv. This is the
// reference E2E test docs/frontend-standards.md's Testing Standards names.
const GOLDEN_CV = path.resolve(
  import.meta.dirname,
  "../../openspec/changes/archive/2026-07-30-parse-candidate-cv/specs/reports/golden-dataset/golden-01-lovelace.pdf",
)

test("mock-authenticated candidate uploads a real PDF and sees it through to completion", async ({
  page,
}) => {
  await page.goto("/workspace/upload")

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
})

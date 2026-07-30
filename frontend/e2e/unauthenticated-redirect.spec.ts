import { test, expect } from "@playwright/test"

// specs/candidate-workspace-shell/spec.md "Authenticated Access Only":
// an unauthenticated visitor is redirected to /login, workspace never
// renders. `?mockSession=unauthenticated` is the mock adapter's real-browser
// escape hatch for this (see useSession.mock.ts) — the mock otherwise
// auto-logs in for local-dev convenience.
test("unauthenticated visitor is redirected to /login", async ({ page }) => {
  await page.goto("/workspace/upload?mockSession=unauthenticated")

  await expect(page).toHaveURL(/\/login/)
  await expect(
    page.getByText(/login is not yet available/i),
  ).toBeVisible()
  await expect(
    page.getByRole("heading", { name: /upload your cv/i }),
  ).not.toBeVisible()
})

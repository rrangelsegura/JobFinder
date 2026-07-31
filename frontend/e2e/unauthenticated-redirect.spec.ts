import { test, expect } from "@playwright/test"

// specs/candidate-workspace-shell/spec.md "Authenticated Access Only":
// an unauthenticated visitor is redirected to /login, workspace never
// renders. `useSession()` defaults to `live` (candidate-authentication
// design.md Decision 4), so a fresh browser context with no session cookie
// exercises the real GET /auth/session -> 401 -> redirect path directly —
// no mock escape hatch needed anymore.
test("unauthenticated visitor is redirected to /login", async ({ page }) => {
  await page.goto("/workspace/upload")

  await expect(page).toHaveURL(/\/login/)
  await expect(
    page.getByRole("heading", { name: /log in to jobfinder/i }),
  ).toBeVisible()
  await expect(
    page.getByRole("heading", { name: /upload your cv/i }),
  ).not.toBeVisible()
})

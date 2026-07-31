import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./e2e",
  // Leading-underscore specs are one-off manual-verification scripts (e.g.
  // depend on a real local file path or a live local LLM) — excluded from
  // the regular suite, run explicitly by filename when needed.
  testIgnore: "**/_*.spec.ts",
  fullyParallel: false,
  retries: 0,
  // The real CV extraction flow (OCR + local LLM) can take well over the
  // 30s default when the model is cold — matches this test's own 60s
  // assertion timeout for the completion state.
  timeout: 90_000,
  reporter: "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 30_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
})

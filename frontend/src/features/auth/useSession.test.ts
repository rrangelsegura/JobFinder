import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

describe("useSession swap point", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("defaults to the live implementation when VITE_AUTH_MODE is unset", async () => {
    vi.unstubAllEnvs()
    const liveModule = await import("./useSession.live")
    const swapModule = await import("./useSession")

    expect(swapModule.useSession).toBe(liveModule.useSession)
  })

  it("selects the mock implementation when VITE_AUTH_MODE=mock", async () => {
    vi.stubEnv("VITE_AUTH_MODE", "mock")
    const mockModule = await import("./useSession.mock")
    const swapModule = await import("./useSession")

    expect(swapModule.useSession).toBe(mockModule.useSession)
  })
})

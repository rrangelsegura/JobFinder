import { render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { vi } from "vitest"
import App from "./App"
import { useSession } from "@/features/auth/useSession"

// design.md Decision 4 (candidate-authentication): `useSession()` now
// defaults to the live adapter, which needs a real backend. This
// integration test only cares that an authenticated session reaches the
// workspace shell, so it stubs the shared `useSession()` boundary directly
// rather than depending on either concrete adapter.
vi.mock("@/features/auth/useSession", () => ({
  useSession: vi.fn(),
}))

const mockedUseSession = vi.mocked(useSession)

describe("App", () => {
  it("redirects to the workspace and renders it for an authenticated candidate", async () => {
    mockedUseSession.mockReturnValue({
      candidateId: 1,
      email: "candidate@example.com",
      isAuthenticated: true,
      isLoading: false,
    })

    const queryClient = new QueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>,
    )

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /upload your cv/i }),
      ).toBeInTheDocument(),
    )
    expect(screen.getByRole("link", { name: /^upload$/i })).toBeInTheDocument()
  })
})

import { render, screen } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import { vi } from "vitest"
import { ProtectedRoute } from "./ProtectedRoute"
import { useSession } from "@/features/auth/useSession"

vi.mock("@/features/auth/useSession", () => ({
  useSession: vi.fn(),
}))

const mockedUseSession = vi.mocked(useSession)

function renderProtectedRoute() {
  return render(
    <MemoryRouter initialEntries={["/workspace"]}>
      <Routes>
        <Route path="/login" element={<div>Login page</div>} />
        <Route path="/verify-email" element={<div>Verify email page</div>} />
        <Route path="/workspace" element={<ProtectedRoute />}>
          <Route index element={<div>Workspace content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe("ProtectedRoute", () => {
  it("redirects to /login when there is no active session", () => {
    mockedUseSession.mockReturnValue({
      candidateId: null,
      email: null,
      emailVerified: null,
      isAuthenticated: false,
      isLoading: false,
    })

    renderProtectedRoute()

    expect(screen.getByText("Login page")).toBeInTheDocument()
    expect(screen.queryByText("Workspace content")).not.toBeInTheDocument()
  })

  it("renders the protected content for an authenticated, verified candidate", () => {
    mockedUseSession.mockReturnValue({
      candidateId: 1,
      email: "candidate@example.com",
      emailVerified: true,
      isAuthenticated: true,
      isLoading: false,
    })

    renderProtectedRoute()

    expect(screen.getByText("Workspace content")).toBeInTheDocument()
  })

  // candidate-email-verification: a valid session alone is no longer
  // enough — an authenticated-but-unverified candidate is routed to the
  // holding page instead of the workspace.
  it("redirects to /verify-email for an authenticated but unverified candidate", () => {
    mockedUseSession.mockReturnValue({
      candidateId: 1,
      email: "candidate@example.com",
      emailVerified: false,
      isAuthenticated: true,
      isLoading: false,
    })

    renderProtectedRoute()

    expect(screen.getByText("Verify email page")).toBeInTheDocument()
    expect(screen.queryByText("Workspace content")).not.toBeInTheDocument()
  })
})

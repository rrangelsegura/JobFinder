import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import { vi } from "vitest"
import { VerifyEmailPage } from "./VerifyEmailPage"
import { useVerifyEmail, useResendVerification } from "./useAuth"
import { useSession } from "./useSession"

vi.mock("./useAuth", () => ({
  useVerifyEmail: vi.fn(),
  useResendVerification: vi.fn(),
}))

vi.mock("./useSession", () => ({
  useSession: vi.fn(),
}))

const mockedUseVerifyEmail = vi.mocked(useVerifyEmail)
const mockedUseResendVerification = vi.mocked(useResendVerification)
const mockedUseSession = vi.mocked(useSession)

function renderPage(path = "/verify-email") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/login" element={<div>Login page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe("VerifyEmailPage", () => {
  const verifyMutate = vi.fn()
  const resendMutate = vi.fn()

  beforeEach(() => {
    verifyMutate.mockReset()
    resendMutate.mockReset()
    mockedUseVerifyEmail.mockReturnValue({
      mutate: verifyMutate,
      isPending: false,
      isSuccess: false,
      isError: false,
    } as unknown as ReturnType<typeof useVerifyEmail>)
    mockedUseResendVerification.mockReturnValue({
      mutate: resendMutate,
      isPending: false,
      isSuccess: false,
    } as unknown as ReturnType<typeof useResendVerification>)
    mockedUseSession.mockReturnValue({
      candidateId: 1,
      email: "candidate@example.com",
      emailVerified: false,
      isAuthenticated: true,
      isLoading: false,
    })
  })

  // No ?token= — reached via ProtectedRoute redirecting an
  // authenticated-but-unverified candidate here.
  describe("holding view (no token)", () => {
    it("shows a check-your-inbox message and does not call verify", () => {
      renderPage("/verify-email")

      expect(screen.getByText(/check your inbox/i)).toBeInTheDocument()
      expect(verifyMutate).not.toHaveBeenCalled()
    })

    it("resending calls the mutation with the session's email", async () => {
      const user = userEvent.setup()
      renderPage("/verify-email")

      await user.click(screen.getByRole("button", { name: /resend/i }))

      expect(resendMutate).toHaveBeenCalledWith("candidate@example.com")
    })

    it("shows a confirmation after a successful resend", () => {
      mockedUseResendVerification.mockReturnValue({
        mutate: resendMutate,
        isPending: false,
        isSuccess: true,
      } as unknown as ReturnType<typeof useResendVerification>)

      renderPage("/verify-email")

      expect(screen.getByRole("status")).toHaveTextContent(/new link has been sent/i)
    })
  })

  // ?token=... — reached by clicking the link in the verification email.
  describe("token-consumption view", () => {
    it("calls verify with the token from the URL on mount", () => {
      renderPage("/verify-email?token=the-token-value")

      expect(verifyMutate).toHaveBeenCalledWith("the-token-value")
    })

    it("shows a success message and a login link once verified", () => {
      mockedUseVerifyEmail.mockReturnValue({
        mutate: verifyMutate,
        isPending: false,
        isSuccess: true,
        isError: false,
      } as unknown as ReturnType<typeof useVerifyEmail>)

      renderPage("/verify-email?token=the-token-value")

      expect(screen.getByRole("status")).toHaveTextContent(/verified/i)
      expect(screen.getByRole("link", { name: /log in/i })).toBeInTheDocument()
    })

    it("shows an error for an invalid or expired token", () => {
      mockedUseVerifyEmail.mockReturnValue({
        mutate: verifyMutate,
        isPending: false,
        isSuccess: false,
        isError: true,
      } as unknown as ReturnType<typeof useVerifyEmail>)

      renderPage("/verify-email?token=bad-token")

      expect(screen.getByRole("alert")).toHaveTextContent(/invalid or has expired/i)
    })
  })
})

import { renderHook, waitFor } from "@testing-library/react"
import { useAuthStore } from "@/stores/authStore"
import { MOCK_SESSION_FIXTURE, useSession } from "./useSession.mock"

describe("useSession.mock", () => {
  beforeEach(() => {
    useAuthStore.setState({
      candidateId: null,
      email: null,
      isAuthenticated: false,
      isLoading: true,
    })
  })

  it("resolves to the documented GET /auth/session fixture shape", async () => {
    const { result } = renderHook(() => useSession())

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current).toEqual({
      candidateId: MOCK_SESSION_FIXTURE.candidateId,
      email: MOCK_SESSION_FIXTURE.email,
      emailVerified: MOCK_SESSION_FIXTURE.emailVerified,
      isAuthenticated: true,
      isLoading: false,
    })
  })
})

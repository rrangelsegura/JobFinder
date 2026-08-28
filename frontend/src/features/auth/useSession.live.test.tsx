import type { ReactNode } from "react"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { vi } from "vitest"
import { useSession } from "./useSession.live"
import { apiClient } from "@/lib/apiClient"
import { useAuthStore } from "@/stores/authStore"
import type { SessionState } from "./useSession.types"

vi.mock("@/lib/apiClient", () => ({
  apiClient: { get: vi.fn() },
}))

const mockedGet = vi.mocked(apiClient.get)

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe("useSession.live", () => {
  beforeEach(() => {
    mockedGet.mockReset()
    useAuthStore.setState({
      candidateId: null,
      email: null,
      isAuthenticated: false,
      isLoading: true,
    })
  })

  // Regression test: ProtectedRoute redirected a freshly-logged-in candidate
  // straight back to /login in real E2E testing because isLoading flipped to
  // false one render before isAuthenticated flipped to true (the store
  // update happened in a useEffect, one render pass behind the query
  // result). isAuthenticated must never read false in the same render where
  // isLoading has already become false and the session actually resolved.
  it("never reports isLoading:false with isAuthenticated:false once a valid session resolves", async () => {
    mockedGet.mockResolvedValue({
      data: {
        status: "success",
        data: {
          candidateId: 7,
          email: "candidate@example.com",
          emailVerified: true,
        },
        agent_trace_id: "trace-1",
        model_used: null,
      },
    })

    const renders: SessionState[] = []
    const { result } = renderHook(
      () => {
        const state = useSession()
        renders.push(state)
        return state
      },
      { wrapper },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current).toEqual({
      candidateId: 7,
      email: "candidate@example.com",
      emailVerified: true,
      isAuthenticated: true,
      isLoading: false,
    })
    // The regression: a render where loading has finished but the store
    // hadn't caught up yet, which ProtectedRoute reads as "no session".
    expect(
      renders.some((r) => r.isLoading === false && r.isAuthenticated === false),
    ).toBe(false)
  })

  it("reports unauthenticated once a 401 resolves", async () => {
    mockedGet.mockRejectedValue({
      isAxiosError: true,
      response: { status: 401 },
    })

    const { result } = renderHook(() => useSession(), { wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current).toEqual({
      candidateId: null,
      email: null,
      emailVerified: null,
      isAuthenticated: false,
      isLoading: false,
    })
  })
})

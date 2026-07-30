import type { ReactNode } from "react"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { vi } from "vitest"
import { useCvExtractionStatus } from "./useCvExtractionStatus"
import { apiClient } from "@/lib/apiClient"

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

function statusResponse(status: "processing" | "completed" | "failed") {
  return {
    data: {
      status: "success",
      data: { status },
      agent_trace_id: "trace-1",
      model_used: null,
    },
  }
}

describe("useCvExtractionStatus", () => {
  beforeEach(() => {
    mockedGet.mockReset()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("polls every 2500ms while the job is processing, and stops once completed", async () => {
    mockedGet
      .mockResolvedValueOnce(statusResponse("processing"))
      .mockResolvedValueOnce(statusResponse("processing"))
      .mockResolvedValueOnce(statusResponse("completed"))

    const { result } = renderHook(() => useCvExtractionStatus("job-1"), {
      wrapper,
    })

    await waitFor(() => expect(mockedGet).toHaveBeenCalledTimes(1))
    expect(result.current.data?.status).toBe("processing")

    await vi.advanceTimersByTimeAsync(2500)
    await waitFor(() => expect(mockedGet).toHaveBeenCalledTimes(2))

    await vi.advanceTimersByTimeAsync(2500)
    await waitFor(() => expect(mockedGet).toHaveBeenCalledTimes(3))
    await waitFor(() => expect(result.current.data?.status).toBe("completed"))

    // No more polling once completed: waiting another interval must not
    // trigger a fourth call.
    await vi.advanceTimersByTimeAsync(5000)
    expect(mockedGet).toHaveBeenCalledTimes(3)
  })

  it("stops polling once the job fails, not only once it completes", async () => {
    mockedGet
      .mockResolvedValueOnce(statusResponse("processing"))
      .mockResolvedValueOnce(statusResponse("failed"))

    const { result } = renderHook(() => useCvExtractionStatus("job-2"), {
      wrapper,
    })

    await waitFor(() => expect(mockedGet).toHaveBeenCalledTimes(1))

    await vi.advanceTimersByTimeAsync(2500)
    await waitFor(() => expect(mockedGet).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(result.current.data?.status).toBe("failed"))

    await vi.advanceTimersByTimeAsync(5000)
    expect(mockedGet).toHaveBeenCalledTimes(2)
  })

  it("does not fetch when jobId is null", () => {
    renderHook(() => useCvExtractionStatus(null), { wrapper })

    expect(mockedGet).not.toHaveBeenCalled()
  })
})

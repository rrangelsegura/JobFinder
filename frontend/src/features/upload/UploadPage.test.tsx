import type { ReactNode } from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { vi } from "vitest"
import { UploadPage } from "./UploadPage"
import { apiClient } from "@/lib/apiClient"
import { useSession } from "@/features/auth/useSession"

vi.mock("@/lib/apiClient", () => ({
  apiClient: { post: vi.fn(), get: vi.fn() },
}))
vi.mock("@/features/auth/useSession", () => ({
  useSession: vi.fn(),
}))

const mockedPost = vi.mocked(apiClient.post)
const mockedGet = vi.mocked(apiClient.get)
const mockedUseSession = vi.mocked(useSession)

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

function pdfFile() {
  return new File(["%PDF-1.4"], "resume.pdf", { type: "application/pdf" })
}

describe("UploadPage", () => {
  beforeEach(() => {
    mockedPost.mockReset()
    mockedGet.mockReset()
    mockedUseSession.mockReturnValue({
      candidateId: 1,
      email: "candidate@example.com",
      isAuthenticated: true,
      isLoading: false,
    })
  })

  it("uploads a PDF, shows processing, then reflects completion without a page reload", async () => {
    mockedPost.mockResolvedValue({
      data: {
        status: "success",
        data: { resumeId: 1, jobId: "job-1", status: "processing" },
        agent_trace_id: "trace-1",
        model_used: null,
      },
    })
    mockedGet
      .mockResolvedValueOnce({
        data: {
          status: "success",
          data: { status: "processing" },
          agent_trace_id: "trace-1",
          model_used: null,
        },
      })
      .mockResolvedValueOnce({
        data: {
          status: "success",
          data: { status: "completed", candidate: {} },
          agent_trace_id: "trace-1",
          model_used: null,
        },
      })

    const user = userEvent.setup()
    render(<UploadPage />, { wrapper })

    await user.upload(screen.getByLabelText(/cv/i), pdfFile())
    await user.click(screen.getByRole("button", { name: /upload/i }))

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(/processing/i),
    )

    await waitFor(
      () =>
        expect(screen.getByRole("status")).toHaveTextContent(
          /success|complete/i,
        ),
      { timeout: 5000 },
    )
  })

  it("shows a non-technical message when extraction fails", async () => {
    mockedPost.mockResolvedValue({
      data: {
        status: "success",
        data: { resumeId: 1, jobId: "job-2", status: "processing" },
        agent_trace_id: "trace-2",
        model_used: null,
      },
    })
    mockedGet.mockResolvedValueOnce({
      data: {
        status: "success",
        data: { status: "failed", error: "Unsupported file type: text/plain" },
        agent_trace_id: "trace-2",
        model_used: null,
      },
    })

    const user = userEvent.setup()
    render(<UploadPage />, { wrapper })

    await user.upload(screen.getByLabelText(/cv/i), pdfFile())
    await user.click(screen.getByRole("button", { name: /upload/i }))

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Please upload a PDF file.",
      ),
    )
    expect(screen.queryByText(/unsupported file type/i)).not.toBeInTheDocument()
  })
})

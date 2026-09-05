import type { ReactNode } from "react"
import { render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router-dom"
import { vi } from "vitest"
import { AnalysisResultsPage } from "./AnalysisResultsPage"
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
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

const POPULATED_RESPONSE = {
  data: {
    status: "success",
    data: {
      hasAnalysis: true,
      personalInfo: {
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada@example.com",
        phone: null,
        address: null,
      },
      education: [
        {
          id: 1,
          institution: "Cambridge",
          title: "Mathematics",
          startDate: null,
          endDate: "1843-01-01",
        },
      ],
      workExperience: [
        {
          id: 1,
          company: "Analytical Engines Ltd",
          position: "Analyst",
          description: "Wrote the first algorithm",
          startDate: "1842-01-01",
          endDate: null,
          responsibilities: [{ id: 1, text: "Designed the algorithm" }],
          projects: [
            {
              id: 1,
              name: "Analytical Engine Algorithm",
              description: null,
              achievements: [{ id: 1, text: "First published algorithm" }],
              stack: [{ id: 1, name: "Mechanical computation" }],
            },
          ],
        },
      ],
      skills: [
        {
          id: 1,
          name: "Mathematics",
          type: "technical",
          proficiency: "Advanced",
        },
      ],
      languages: [{ id: 1, name: "English", proficiency: "native" }],
      certifications: [
        { id: 1, name: "Royal Society Fellow", issuer: null, issueDate: null },
      ],
    },
    agent_trace_id: "trace-1",
    model_used: null,
  },
}

const EMPTY_RESPONSE = {
  data: {
    status: "success",
    data: { hasAnalysis: false },
    agent_trace_id: "trace-2",
    model_used: null,
  },
}

describe("AnalysisResultsPage", () => {
  beforeEach(() => {
    mockedGet.mockReset()
  })

  it("shows the empty state with a link to Upload when there's no analysis yet", async () => {
    mockedGet.mockResolvedValue(EMPTY_RESPONSE)

    render(<AnalysisResultsPage />, { wrapper })

    await waitFor(() =>
      expect(
        screen.getByText(/no analysis available yet/i),
      ).toBeInTheDocument(),
    )
    const uploadLink = screen.getByRole("link", { name: /go to upload/i })
    expect(uploadLink).toHaveAttribute("href", "/workspace/upload")
  })

  it("renders all sections when analysis data is present", async () => {
    mockedGet.mockResolvedValue(POPULATED_RESPONSE)

    render(<AnalysisResultsPage />, { wrapper })

    await waitFor(() =>
      expect(screen.getByText("Ada Lovelace")).toBeInTheDocument(),
    )
    expect(screen.getByText("Cambridge")).toBeInTheDocument()
    expect(screen.getByText("Analytical Engines Ltd")).toBeInTheDocument()
    expect(screen.getByText("Designed the algorithm")).toBeInTheDocument()
    expect(screen.getByText("Analytical Engine Algorithm")).toBeInTheDocument()
    expect(screen.getAllByText(/Mathematics/).length).toBeGreaterThan(0)
    expect(screen.getByText(/Advanced/)).toBeInTheDocument()
    expect(screen.getByText(/English/)).toBeInTheDocument()
    expect(screen.getByText("Royal Society Fellow")).toBeInTheDocument()
  })

  it("renders no edit controls anywhere on the page", async () => {
    mockedGet.mockResolvedValue(POPULATED_RESPONSE)

    render(<AnalysisResultsPage />, { wrapper })

    await waitFor(() =>
      expect(screen.getByText("Ada Lovelace")).toBeInTheDocument(),
    )
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
  })
})

import type { ReactNode } from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { vi } from "vitest"
import { InvitationRepliesPage } from "./InvitationRepliesPage"
import { apiClient } from "@/lib/apiClient"

vi.mock("@/lib/apiClient", () => ({
  apiClient: { post: vi.fn(), get: vi.fn() },
}))

const mockedPost = vi.mocked(apiClient.post)
const mockedGet = vi.mocked(apiClient.get)

const INVITATION_TEXT = "Hi Rene, I wanted to reach out about a role at Baxter."
const DRAFT =
  "Hi Alexis,\n\nThank you for reaching out about the Business Intelligence Specialist role at Baxter."

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

function accepted(jobId = "job-1") {
  return {
    data: {
      status: "success",
      data: { invitationId: 1, jobId, status: "processing" },
      agent_trace_id: "t",
      model_used: null,
    },
  }
}

function statusResponse(data: Record<string, unknown>) {
  return {
    data: { status: "success", data, agent_trace_id: "t", model_used: null },
  }
}

const COMPLETED = statusResponse({
  status: "completed",
  invitation: {
    recruiterName: "Alexis Aguiñaga",
    recruiterTitle: "Senior Talent Acquisition Consultant",
    company: "Baxter International Inc.",
    roleTitle: "Business Intelligence Specialist",
    location: "Bogotá, D.C.",
    language: "en",
    callToAction: null,
  },
  draftReply: DRAFT,
  durationMs: 45000,
})

async function submit(
  user: ReturnType<typeof userEvent.setup>,
  text = INVITATION_TEXT,
) {
  await user.click(screen.getByLabelText(/invitation/i))
  await user.paste(text)
  await user.click(screen.getByRole("button", { name: /draft a reply/i }))
}

describe("InvitationRepliesPage", () => {
  beforeEach(() => {
    mockedPost.mockReset()
    mockedGet.mockReset()
  })

  // Spec: "Submit is disabled for blank text"
  it("disables submit while the text is empty or only whitespace", async () => {
    const user = userEvent.setup()
    render(<InvitationRepliesPage />, { wrapper })
    const button = screen.getByRole("button", { name: /draft a reply/i })

    expect(button).toBeDisabled()

    await user.click(screen.getByLabelText(/invitation/i))
    await user.paste("   \n  ")
    expect(button).toBeDisabled()

    await user.paste("Hello")
    expect(button).toBeEnabled()
  })

  // Spec: "Character limit is communicated"
  it("shows a limit message and keeps submit disabled above 5000 characters", async () => {
    const user = userEvent.setup()
    render(<InvitationRepliesPage />, { wrapper })

    await user.click(screen.getByLabelText(/invitation/i))
    await user.paste("a".repeat(5001))

    expect(screen.getByRole("alert")).toHaveTextContent(
      /too long|limit|5,?000/i,
    )
    expect(
      screen.getByRole("button", { name: /draft a reply/i }),
    ).toBeDisabled()
  })

  it("accepts exactly 5000 characters", async () => {
    const user = userEvent.setup()
    render(<InvitationRepliesPage />, { wrapper })

    await user.click(screen.getByLabelText(/invitation/i))
    await user.paste("a".repeat(5000))

    expect(screen.getByRole("button", { name: /draft a reply/i })).toBeEnabled()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("sends the text with the interested intent by default", async () => {
    mockedPost.mockResolvedValue(accepted())
    mockedGet.mockResolvedValue(
      statusResponse({ status: "processing", phase: "queued" }),
    )
    const user = userEvent.setup()
    render(<InvitationRepliesPage />, { wrapper })

    await submit(user)

    expect(mockedPost).toHaveBeenCalledWith("/invitations/reply-drafts", {
      invitationText: INVITATION_TEXT,
      intent: "interested",
    })
  })

  it("sends the intent the candidate selected", async () => {
    mockedPost.mockResolvedValue(accepted())
    mockedGet.mockResolvedValue(
      statusResponse({ status: "processing", phase: "queued" }),
    )
    const user = userEvent.setup()
    render(<InvitationRepliesPage />, { wrapper })

    await user.selectOptions(
      screen.getByLabelText(/what do you want to do/i),
      "decline",
    )
    await submit(user)

    expect(mockedPost).toHaveBeenCalledWith("/invitations/reply-drafts", {
      invitationText: INVITATION_TEXT,
      intent: "decline",
    })
  })

  // Spec: "Progress is shown while processing"
  it.each([
    ["queued", /waiting to start/i],
    ["parsing", /reading the invitation/i],
    ["drafting", /writing your reply/i],
    ["saving", /saving/i],
  ])("shows a message for the %s phase", async (phase, copy) => {
    mockedPost.mockResolvedValue(accepted())
    mockedGet.mockResolvedValue(statusResponse({ status: "processing", phase }))
    const user = userEvent.setup()
    render(<InvitationRepliesPage />, { wrapper })

    await submit(user)

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(copy),
    )
  })

  // Spec: "Completed draft is displayed and copyable"
  it("shows the parsed summary and a read-only draft when the job completes", async () => {
    mockedPost.mockResolvedValue(accepted())
    mockedGet.mockResolvedValue(COMPLETED)
    const user = userEvent.setup()
    render(<InvitationRepliesPage />, { wrapper })

    await submit(user)

    await waitFor(() =>
      expect(screen.getByLabelText(/draft reply/i)).toBeInTheDocument(),
    )
    expect(screen.getByText("Alexis Aguiñaga")).toBeInTheDocument()
    expect(screen.getByText("Baxter International Inc.")).toBeInTheDocument()
    expect(
      screen.getByText("Business Intelligence Specialist"),
    ).toBeInTheDocument()
    expect(screen.getByText("Bogotá, D.C.")).toBeInTheDocument()
    const draft = screen.getByLabelText(/draft reply/i) as HTMLTextAreaElement
    expect(draft.value).toBe(DRAFT)
    expect(draft).toHaveAttribute("readonly")
  })

  it("copies the draft to the clipboard", async () => {
    mockedPost.mockResolvedValue(accepted())
    mockedGet.mockResolvedValue(COMPLETED)
    const user = userEvent.setup()
    render(<InvitationRepliesPage />, { wrapper })
    await submit(user)

    await user.click(await screen.findByRole("button", { name: /copy/i }))

    expect(await navigator.clipboard.readText()).toBe(DRAFT)
    expect(await screen.findByText(/copied/i)).toBeInTheDocument()
  })

  it("omits summary fields the invitation did not state", async () => {
    mockedPost.mockResolvedValue(accepted())
    mockedGet.mockResolvedValue(
      statusResponse({
        status: "completed",
        invitation: {
          recruiterName: "Alexis Aguiñaga",
          recruiterTitle: null,
          company: "Baxter International Inc.",
          roleTitle: null,
          location: null,
          language: "en",
          callToAction: null,
        },
        draftReply: DRAFT,
        durationMs: 1000,
      }),
    )
    const user = userEvent.setup()
    render(<InvitationRepliesPage />, { wrapper })

    await submit(user)

    await screen.findByLabelText(/draft reply/i)
    expect(screen.queryByText(/^location$/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/null/i)).not.toBeInTheDocument()
  })

  // Spec: "The draft is clearly not sent"
  it("states that the message has not been sent and must be reviewed by the candidate", async () => {
    mockedPost.mockResolvedValue(accepted())
    mockedGet.mockResolvedValue(COMPLETED)
    const user = userEvent.setup()
    render(<InvitationRepliesPage />, { wrapper })

    await submit(user)

    expect(await screen.findByText(/has not been sent/i)).toBeInTheDocument()
    expect(screen.getByText(/review/i)).toBeInTheDocument()
  })

  // Spec: "Failure allows retry"
  it("shows the error and retries with the preserved text and intent", async () => {
    // Each submission is a new BullMQ job, so a retry polls a new jobId.
    mockedPost
      .mockResolvedValueOnce(accepted("job-1"))
      .mockResolvedValueOnce(accepted("job-2"))
    mockedGet.mockImplementation(async (url: string) =>
      url.endsWith("/job-1")
        ? statusResponse({
            status: "failed",
            error: "We couldn't write a reply this time. Please try again.",
            durationMs: 3000,
          })
        : COMPLETED,
    )
    const user = userEvent.setup()
    render(<InvitationRepliesPage />, { wrapper })

    await user.selectOptions(
      screen.getByLabelText(/what do you want to do/i),
      "request_more_info",
    )
    await submit(user)

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /couldn't write a reply/i,
    )

    await user.click(screen.getByRole("button", { name: /try again/i }))

    expect(mockedPost).toHaveBeenCalledTimes(2)
    expect(mockedPost).toHaveBeenLastCalledWith("/invitations/reply-drafts", {
      invitationText: INVITATION_TEXT,
      intent: "request_more_info",
    })
    expect(await screen.findByLabelText(/draft reply/i)).toBeInTheDocument()
  })

  it("shows an error when the request itself is rejected", async () => {
    mockedPost.mockRejectedValue(
      new Error("Request failed with status code 500"),
    )
    const user = userEvent.setup()
    render(<InvitationRepliesPage />, { wrapper })

    await submit(user)

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /couldn't send|try again/i,
    )
    expect(screen.queryByText(/status code 500/i)).not.toBeInTheDocument()
  })

  it("lets the candidate start over with a new invitation after a draft", async () => {
    mockedPost.mockResolvedValue(accepted())
    mockedGet.mockResolvedValue(COMPLETED)
    const user = userEvent.setup()
    render(<InvitationRepliesPage />, { wrapper })
    await submit(user)
    await screen.findByLabelText(/draft reply/i)

    await user.click(screen.getByRole("button", { name: /new invitation/i }))

    expect(screen.getByLabelText(/invitation/i)).toHaveValue("")
    expect(screen.queryByLabelText(/draft reply/i)).not.toBeInTheDocument()
  })
})

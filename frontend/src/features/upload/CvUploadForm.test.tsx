import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { vi } from "vitest"
import { CvUploadForm } from "./CvUploadForm"
import { useCvUpload } from "./useCvUpload"
import { useSession } from "@/features/auth/useSession"

vi.mock("./useCvUpload", () => ({
  useCvUpload: vi.fn(),
}))
vi.mock("@/features/auth/useSession", () => ({
  useSession: vi.fn(),
}))

const mockedUseCvUpload = vi.mocked(useCvUpload)
const mockedUseSession = vi.mocked(useSession)

function pdfFile(name = "resume.pdf") {
  return new File(["%PDF-1.4"], name, { type: "application/pdf" })
}

function textFile(name = "resume.txt") {
  return new File(["not a pdf"], name, { type: "text/plain" })
}

describe("CvUploadForm", () => {
  const mutate = vi.fn()

  beforeEach(() => {
    mutate.mockReset()
    mockedUseCvUpload.mockReturnValue({
      mutate,
      isPending: false,
    } as unknown as ReturnType<typeof useCvUpload>)
    mockedUseSession.mockReturnValue({
      candidateId: 1,
      email: "candidate@example.com",
      isAuthenticated: true,
      isLoading: false,
    })
  })

  it("rejects a non-PDF file with a client-side validation error", async () => {
    const user = userEvent.setup({ applyAccept: false })
    render(<CvUploadForm onUploaded={vi.fn()} />)

    const input = screen.getByLabelText(/cv/i)
    await user.upload(input, textFile())

    expect(screen.getByRole("alert")).toHaveTextContent(/pdf/i)
    expect(screen.getByRole("button", { name: /upload/i })).toBeDisabled()
  })

  it("accepts a PDF file with no validation error", async () => {
    const user = userEvent.setup()
    render(<CvUploadForm onUploaded={vi.fn()} />)

    const input = screen.getByLabelText(/cv/i)
    await user.upload(input, pdfFile())

    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /upload/i })).toBeEnabled()
  })

  it("submits the selected PDF for the current candidate", async () => {
    const user = userEvent.setup()
    render(<CvUploadForm onUploaded={vi.fn()} />)

    const input = screen.getByLabelText(/cv/i)
    await user.upload(input, pdfFile())
    await user.click(screen.getByRole("button", { name: /upload/i }))

    expect(mutate).toHaveBeenCalledWith(
      { file: expect.any(File), candidateId: 1 },
      expect.anything(),
    )
  })
})

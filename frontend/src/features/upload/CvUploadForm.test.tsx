import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { vi } from "vitest"
import { CvUploadForm } from "./CvUploadForm"
import { useCvUpload } from "./useCvUpload"

vi.mock("./useCvUpload", () => ({
  useCvUpload: vi.fn(),
}))

const mockedUseCvUpload = vi.mocked(useCvUpload)

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

  // cv-upload delta spec: candidateId is derived server-side from the
  // session, never sent by the client.
  it("submits the selected PDF without a client-supplied candidateId", async () => {
    const user = userEvent.setup()
    render(<CvUploadForm onUploaded={vi.fn()} />)

    const input = screen.getByLabelText(/cv/i)
    await user.upload(input, pdfFile())
    await user.click(screen.getByRole("button", { name: /upload/i }))

    expect(mutate).toHaveBeenCalledWith(
      { file: expect.any(File) },
      expect.anything(),
    )
  })
})

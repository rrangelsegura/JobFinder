import { render, screen } from "@testing-library/react"
import { UploadStatusIndicator } from "./UploadStatusIndicator"

describe("UploadStatusIndicator", () => {
  it("shows a processing indicator, distinct from success/failure content", () => {
    render(<UploadStatusIndicator status="processing" />)

    expect(screen.getByRole("status")).toHaveTextContent(/processing/i)
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("shows queued-specific copy", () => {
    render(<UploadStatusIndicator status="processing" phase="queued" />)
    expect(screen.getByRole("status")).toHaveTextContent(/waiting to start/i)
  })

  it("shows extracting-specific copy", () => {
    render(<UploadStatusIndicator status="processing" phase="extracting" />)
    expect(screen.getByRole("status")).toHaveTextContent(/analyzing your cv/i)
  })

  it("shows saving-specific copy", () => {
    render(<UploadStatusIndicator status="processing" phase="saving" />)
    expect(screen.getByRole("status")).toHaveTextContent(/saving your profile/i)
  })

  it("falls back to generic processing copy when no phase is given", () => {
    render(<UploadStatusIndicator status="processing" />)
    expect(screen.getByRole("status")).toHaveTextContent(/processing your cv/i)
  })

  it("shows a success state on completion", () => {
    render(<UploadStatusIndicator status="completed" />)

    expect(screen.getByRole("status")).toHaveTextContent(/success|complete/i)
  })

  it("shows the given non-technical failure message, not the raw error", () => {
    render(
      <UploadStatusIndicator
        status="failed"
        errorMessage="Please upload a PDF file."
      />,
    )

    const alert = screen.getByRole("alert")
    expect(alert).toHaveTextContent("Please upload a PDF file.")
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })
})

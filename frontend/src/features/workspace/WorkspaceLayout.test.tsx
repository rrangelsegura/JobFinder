import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import { WorkspaceLayout } from "./WorkspaceLayout"

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={["/workspace/upload"]}>
      <Routes>
        <Route path="/workspace" element={<WorkspaceLayout />}>
          <Route path="upload" element={<div>Upload content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe("WorkspaceLayout", () => {
  it("shows all four navigation sections", () => {
    renderLayout()

    expect(screen.getByText("Upload")).toBeInTheDocument()
    expect(screen.getByText("Chat")).toBeInTheDocument()
    expect(screen.getByText("Analysis Results")).toBeInTheDocument()
    expect(screen.getByText("Action Plan")).toBeInTheDocument()
  })

  it("renders Upload as a live navigable link", () => {
    renderLayout()

    const uploadLink = screen.getByRole("link", { name: /upload/i })
    expect(uploadLink).toHaveAttribute("href", "/workspace/upload")
  })

  it("renders Chat, Analysis Results, and Action Plan as disabled, not links", () => {
    renderLayout()

    expect(
      screen.queryByRole("link", { name: /^chat$/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: /analysis results/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: /action plan/i }),
    ).not.toBeInTheDocument()

    expect(screen.getAllByText(/coming soon/i)).toHaveLength(3)
  })

  it("does not navigate away when a disabled nav item is clicked", async () => {
    const user = userEvent.setup()
    renderLayout()

    await user.click(screen.getByText("Chat"))

    expect(screen.getByText("Upload content")).toBeInTheDocument()
  })
})

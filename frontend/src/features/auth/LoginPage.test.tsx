import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import { vi } from "vitest"
import { LoginPage } from "./LoginPage"
import { useLogin } from "./useAuth"

vi.mock("./useAuth", () => ({
  useLogin: vi.fn(),
}))

const mockedUseLogin = vi.mocked(useLogin)

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/workspace/upload"
          element={<div>Workspace content</div>}
        />
      </Routes>
    </MemoryRouter>,
  )
}

describe("LoginPage", () => {
  const mutate = vi.fn()

  beforeEach(() => {
    mutate.mockReset()
    mockedUseLogin.mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useLogin>)
  })

  it("submits the entered email and password", async () => {
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByLabelText(/email/i), "candidate@example.com")
    await user.type(screen.getByLabelText(/password/i), "supersecret")
    await user.click(screen.getByRole("button", { name: /log in/i }))

    expect(mutate).toHaveBeenCalledWith(
      { email: "candidate@example.com", password: "supersecret" },
      expect.anything(),
    )
  })

  it("shows the generic error on failed login", () => {
    mockedUseLogin.mockReturnValue({
      mutate,
      isPending: false,
      isError: true,
      error: new Error("Invalid email or password"),
    } as unknown as ReturnType<typeof useLogin>)

    renderPage()

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Invalid email or password",
    )
  })

  it("navigates to the workspace on successful login", async () => {
    mutate.mockImplementation((_vars, options) => {
      options?.onSuccess?.()
    })
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByLabelText(/email/i), "candidate@example.com")
    await user.type(screen.getByLabelText(/password/i), "supersecret")
    await user.click(screen.getByRole("button", { name: /log in/i }))

    expect(screen.getByText("Workspace content")).toBeInTheDocument()
  })
})

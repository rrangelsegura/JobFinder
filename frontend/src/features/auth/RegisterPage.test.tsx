import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { vi } from "vitest"
import { RegisterPage } from "./RegisterPage"
import { useRegister } from "./useAuth"

vi.mock("./useAuth", () => ({
  useRegister: vi.fn(),
}))

const mockedUseRegister = vi.mocked(useRegister)

function renderPage() {
  return render(
    <MemoryRouter>
      <RegisterPage />
    </MemoryRouter>,
  )
}

describe("RegisterPage", () => {
  const mutate = vi.fn()

  beforeEach(() => {
    mutate.mockReset()
    mockedUseRegister.mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useRegister>)
  })

  it("submits the entered email and password", async () => {
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByLabelText(/email/i), "new@example.com")
    await user.type(screen.getByLabelText(/password/i), "supersecret")
    await user.click(screen.getByRole("button", { name: /register/i }))

    expect(mutate).toHaveBeenCalledWith(
      { email: "new@example.com", password: "supersecret" },
      expect.anything(),
    )
  })

  it("shows the duplicate-email error returned by the mutation", () => {
    mockedUseRegister.mockReturnValue({
      mutate,
      isPending: false,
      isError: true,
      error: new Error("Email already registered."),
    } as unknown as ReturnType<typeof useRegister>)

    renderPage()

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Email already registered.",
    )
  })
})

import { render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import App from "./App"

describe("App", () => {
  it("redirects to the workspace and renders it for the mock-authenticated candidate", async () => {
    const queryClient = new QueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>,
    )

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /upload your cv/i }),
      ).toBeInTheDocument(),
    )
    expect(screen.getByRole("link", { name: /^upload$/i })).toBeInTheDocument()
  })
})

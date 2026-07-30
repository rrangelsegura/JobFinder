import type { ReactNode } from "react"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { vi } from "vitest"
import { useRegister, useLogin, useLogout } from "./useAuth"
import { apiClient } from "@/lib/apiClient"

vi.mock("@/lib/apiClient", () => ({
  apiClient: { post: vi.fn() },
}))

const mockedPost = vi.mocked(apiClient.post)

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe("useRegister", () => {
  beforeEach(() => {
    mockedPost.mockReset()
  })

  it("posts to /auth/register and returns the candidateId", async () => {
    mockedPost.mockResolvedValue({
      data: { status: "success", data: { candidateId: 5 } },
    })

    const { result } = renderHook(() => useRegister(), { wrapper })
    result.current.mutate({ email: "new@example.com", password: "supersecret" })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockedPost).toHaveBeenCalledWith("/auth/register", {
      email: "new@example.com",
      password: "supersecret",
    })
    expect(result.current.data).toEqual({ candidateId: 5 })
  })

  it("surfaces the backend's duplicate-email error message", async () => {
    mockedPost.mockRejectedValue({
      isAxiosError: true,
      response: { data: { data: { error: "Email already registered." } } },
    })

    const { result } = renderHook(() => useRegister(), { wrapper })
    result.current.mutate({ email: "dup@example.com", password: "supersecret" })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe("Email already registered.")
  })
})

describe("useLogin", () => {
  beforeEach(() => {
    mockedPost.mockReset()
  })

  it("posts to /auth/login and returns the session data", async () => {
    mockedPost.mockResolvedValue({
      data: {
        status: "success",
        data: { candidateId: 5, email: "candidate@example.com" },
      },
    })

    const { result } = renderHook(() => useLogin(), { wrapper })
    result.current.mutate({
      email: "candidate@example.com",
      password: "supersecret",
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual({
      candidateId: 5,
      email: "candidate@example.com",
    })
  })

  it("surfaces the generic invalid-credentials error message", async () => {
    mockedPost.mockRejectedValue({
      isAxiosError: true,
      response: { data: { data: { error: "Invalid email or password" } } },
    })

    const { result } = renderHook(() => useLogin(), { wrapper })
    result.current.mutate({
      email: "candidate@example.com",
      password: "wrong",
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe("Invalid email or password")
  })
})

describe("useLogout", () => {
  beforeEach(() => {
    mockedPost.mockReset()
  })

  it("posts to /auth/logout", async () => {
    mockedPost.mockResolvedValue({ data: { status: "success", data: {} } })

    const { result } = renderHook(() => useLogout(), { wrapper })
    result.current.mutate()

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockedPost).toHaveBeenCalledWith("/auth/logout")
  })
})

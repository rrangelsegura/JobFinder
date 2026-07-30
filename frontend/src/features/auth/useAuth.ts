import { isAxiosError } from "axios"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/apiClient"

interface StandardResponse<T> {
  status: "success" | "error"
  data: T
  agent_trace_id: string
  model_used: string | null
}

function withBackendErrorMessage<T>(promise: Promise<T>): Promise<T> {
  return promise.catch((error: unknown) => {
    if (
      isAxiosError(error) &&
      typeof error.response?.data?.data?.error === "string"
    ) {
      throw new Error(error.response.data.data.error)
    }
    throw error
  })
}

export interface RegisterParams {
  email: string
  password: string
}

export interface RegisterData {
  candidateId: number
}

async function register(params: RegisterParams): Promise<RegisterData> {
  const { data } = await apiClient.post<StandardResponse<RegisterData>>(
    "/auth/register",
    params,
  )
  return data.data
}

export function useRegister() {
  return useMutation({
    mutationFn: (params: RegisterParams) =>
      withBackendErrorMessage(register(params)),
  })
}

export interface LoginParams {
  email: string
  password: string
}

export interface LoginData {
  candidateId: number
  email: string
}

async function login(params: LoginParams): Promise<LoginData> {
  const { data } = await apiClient.post<StandardResponse<LoginData>>(
    "/auth/login",
    params,
  )
  return data.data
}

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (params: LoginParams) => withBackendErrorMessage(login(params)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "session"] })
    },
  })
}

async function logout(): Promise<void> {
  await apiClient.post("/auth/logout")
}

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "session"] })
    },
  })
}

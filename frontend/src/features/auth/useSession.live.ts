import { useEffect } from "react"
import { isAxiosError } from "axios"
import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/apiClient"
import { useAuthStore } from "@/stores/authStore"
import type { SessionState, UseSession } from "./useSession.types"

interface SessionResponse {
  status: "success"
  data: { candidateId: number; email: string }
  agent_trace_id: string
  model_used: string | null
}

type SessionData = SessionResponse["data"] | null

async function fetchSession(): Promise<SessionData> {
  try {
    const { data } = await apiClient.get<SessionResponse>("/auth/session")
    return data.data
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 401) {
      return null
    }
    throw error
  }
}

// Real implementation of the `useSession()` boundary (design.md Decision 1
// of candidate-workspace). The returned state is derived directly from the
// query result, not from `authStore` — `authStore` is kept in sync via the
// effect below purely as a side-channel for other future consumers, but
// this hook's own return value must never lag a render behind the query,
// or a caller like ProtectedRoute can observe `isLoading:false` with a
// stale `isAuthenticated:false` in between the query settling and the
// effect running (a real bug caught by E2E testing: a freshly-logged-in
// candidate was bounced straight back to /login).
export const useSession: UseSession = (): SessionState => {
  const setAuthenticated = useAuthStore((state) => state.setAuthenticated)
  const setUnauthenticated = useAuthStore((state) => state.setUnauthenticated)

  const query = useQuery({
    queryKey: ["auth", "session"],
    queryFn: fetchSession,
    retry: false,
    staleTime: Infinity,
  })

  useEffect(() => {
    if (!query.isSuccess) return
    if (query.data) {
      setAuthenticated(query.data.candidateId, query.data.email)
    } else {
      setUnauthenticated()
    }
  }, [query.isSuccess, query.data, setAuthenticated, setUnauthenticated])

  if (query.data) {
    return {
      candidateId: query.data.candidateId,
      email: query.data.email,
      isAuthenticated: true,
      isLoading: query.isLoading,
    }
  }

  return {
    candidateId: null,
    email: null,
    isAuthenticated: false,
    isLoading: query.isLoading,
  }
}

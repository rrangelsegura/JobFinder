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

// Real implementation of the `useSession()` boundary (design.md Decision 1).
// Written now so the swap to it in `useSession.ts` is a one-line change once
// US-003 ships `GET /auth/session` — not genuinely exercisable end-to-end
// until then.
export const useSession: UseSession = (): SessionState => {
  const candidateId = useAuthStore((state) => state.candidateId)
  const email = useAuthStore((state) => state.email)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
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

  return {
    candidateId,
    email,
    isAuthenticated,
    isLoading: query.isLoading,
  }
}

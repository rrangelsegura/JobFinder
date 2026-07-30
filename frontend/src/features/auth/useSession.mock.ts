import { useEffect } from "react"
import { useAuthStore } from "@/stores/authStore"
import type { SessionState, UseSession } from "./useSession.types"

// Fixture shape matches US-003's documented `GET /auth/session` 200 response
// (`{ candidateId, email }`) exactly. Update this the moment US-003's real
// proposal/specs are written, per design.md's drift risk mitigation.
export const MOCK_SESSION_FIXTURE = {
  candidateId: 1,
  email: "candidate@example.com",
} as const

// Playwright E2E needs a real-browser way to exercise the "no active
// session" path (specs/candidate-workspace-shell "Unauthenticated visitor is
// redirected") even though the mock normally auto-logs in for local-dev
// convenience. `?mockSession=unauthenticated` is that escape hatch — it
// changes nothing about default dev/test behavior.
function wantsUnauthenticatedMockSession(): boolean {
  if (typeof window === "undefined") return false
  return (
    new URLSearchParams(window.location.search).get("mockSession") ===
    "unauthenticated"
  )
}

export const useSession: UseSession = (): SessionState => {
  const candidateId = useAuthStore((state) => state.candidateId)
  const email = useAuthStore((state) => state.email)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const isLoading = useAuthStore((state) => state.isLoading)
  const setAuthenticated = useAuthStore((state) => state.setAuthenticated)
  const setUnauthenticated = useAuthStore((state) => state.setUnauthenticated)

  useEffect(() => {
    if (wantsUnauthenticatedMockSession()) {
      setUnauthenticated()
      return
    }
    setAuthenticated(
      MOCK_SESSION_FIXTURE.candidateId,
      MOCK_SESSION_FIXTURE.email,
    )
  }, [setAuthenticated, setUnauthenticated])

  return { candidateId, email, isAuthenticated, isLoading }
}

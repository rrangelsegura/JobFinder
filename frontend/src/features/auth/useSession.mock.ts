import { useEffect } from "react"
import { useAuthStore } from "@/stores/authStore"
import type { SessionState, UseSession } from "./useSession.types"

// Fixture shape matches `GET /auth/session`'s documented 200 response
// (`{ candidateId, email, emailVerified }`) exactly.
export const MOCK_SESSION_FIXTURE = {
  candidateId: 1,
  email: "candidate@example.com",
  emailVerified: true,
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

// candidate-email-verification: same escape-hatch pattern, one dimension
// further — `?mockSession=unverified` exercises the "authenticated but not
// yet verified" holding-page path without needing a real token/email flow.
function wantsUnverifiedMockSession(): boolean {
  if (typeof window === "undefined") return false
  return (
    new URLSearchParams(window.location.search).get("mockSession") ===
    "unverified"
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

  const emailVerified = isAuthenticated
    ? !wantsUnverifiedMockSession() && MOCK_SESSION_FIXTURE.emailVerified
    : null

  return { candidateId, email, emailVerified, isAuthenticated, isLoading }
}

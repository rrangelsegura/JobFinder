import { Navigate, Outlet } from "react-router-dom"
import { useSession } from "@/features/auth/useSession"

// specs/candidate-workspace-shell/spec.md "Authenticated Access Only":
// no session -> redirect to /login without rendering workspace content.
// candidate-email-verification: a valid session alone is no longer
// sufficient — an authenticated-but-unverified candidate is redirected to
// the verify-email holding page instead, mirroring requireAuth's 403 gate
// on the backend for the same condition.
export function ProtectedRoute() {
  const { isAuthenticated, isLoading, emailVerified } = useSession()

  if (isLoading) {
    return null
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (!emailVerified) {
    return <Navigate to="/verify-email" replace />
  }

  return <Outlet />
}

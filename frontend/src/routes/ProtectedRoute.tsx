import { Navigate, Outlet } from "react-router-dom"
import { useSession } from "@/features/auth/useSession"

// specs/candidate-workspace-shell/spec.md "Authenticated Access Only":
// no session -> redirect to /login without rendering workspace content.
export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useSession()

  if (isLoading) {
    return null
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

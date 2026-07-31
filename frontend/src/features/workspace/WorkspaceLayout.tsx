import { NavLink, Outlet, useNavigate } from "react-router-dom"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useLogout } from "@/features/auth/useAuth"
import { DisabledNavItem } from "./DisabledNavItem"

// The four sections required by specs/candidate-workspace-shell/spec.md's
// "Persistent Navigation Across Four Sections" requirement. Only Upload is
// live; the rest are intentionally unbuilt placeholders (design.md
// Non-Goals).
const DISABLED_SECTIONS = ["Chat", "Analysis Results", "Action Plan"] as const

export function WorkspaceLayout() {
  const logout = useLogout()
  const navigate = useNavigate()

  function handleLogout() {
    logout.mutate(undefined, { onSuccess: () => navigate("/login") })
  }

  return (
    <div className="flex min-h-screen bg-muted/30">
      <nav className="flex w-56 flex-col gap-1 border-r border-border bg-card p-4">
        <p className="mb-3 px-3 text-sm font-semibold tracking-tight">
          JobFinder
        </p>
        <NavLink
          to="/workspace/upload"
          className={({ isActive }) =>
            cn(
              "rounded-lg px-3 py-2 text-sm font-medium",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-foreground hover:bg-muted",
            )
          }
        >
          Upload
        </NavLink>
        {DISABLED_SECTIONS.map((label) => (
          <DisabledNavItem key={label} label={label} />
        ))}
        <Button
          variant="outline"
          className="mt-auto"
          disabled={logout.isPending}
          onClick={handleLogout}
        >
          Log out
        </Button>
      </nav>
      <main className="flex-1 p-8">
        <Outlet />
      </main>
    </div>
  )
}

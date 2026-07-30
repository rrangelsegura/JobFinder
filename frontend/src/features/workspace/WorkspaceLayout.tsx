import { NavLink, Outlet } from "react-router-dom"
import { cn } from "@/lib/utils"
import { DisabledNavItem } from "./DisabledNavItem"

// The four sections required by specs/candidate-workspace-shell/spec.md's
// "Persistent Navigation Across Four Sections" requirement. Only Upload is
// live; the rest are intentionally unbuilt placeholders (design.md
// Non-Goals).
const DISABLED_SECTIONS = ["Chat", "Analysis Results", "Action Plan"] as const

export function WorkspaceLayout() {
  return (
    <div className="flex min-h-screen">
      <nav className="flex w-56 flex-col gap-1 border-r border-border p-4">
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
      </nav>
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  )
}

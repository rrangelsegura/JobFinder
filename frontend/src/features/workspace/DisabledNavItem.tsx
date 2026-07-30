import { cn } from "@/lib/utils"

interface DisabledNavItemProps {
  label: string
}

// Visually distinct from a broken/dead link (design.md Risk mitigation):
// muted text + an explicit "Coming soon" badge, rendered as a non-interactive
// span rather than an <a>/<button> so it never navigates.
export function DisabledNavItem({ label }: DisabledNavItemProps) {
  return (
    <span
      aria-disabled="true"
      className={cn(
        "flex cursor-not-allowed items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground/60",
      )}
    >
      {label}
      <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
        Coming soon
      </span>
    </span>
  )
}

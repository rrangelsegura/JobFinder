// Single wiring point selecting which `useSession()` implementation is
// active (design.md Decision 1). Swapping to the real backend once US-003
// ships is a one-line change here — nothing else in the app imports
// `useSession.mock` or `useSession.live` directly.
import { useSession as useMockSession } from "./useSession.mock"
import { useSession as useLiveSession } from "./useSession.live"
import type { UseSession } from "./useSession.types"

export const useSession: UseSession =
  import.meta.env.VITE_AUTH_MODE === "live" ? useLiveSession : useMockSession

export type { SessionState, UseSession } from "./useSession.types"

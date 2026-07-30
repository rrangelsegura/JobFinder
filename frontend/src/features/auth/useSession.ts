// Single wiring point selecting which `useSession()` implementation is
// active (design.md Decision 1 of candidate-workspace). `live` is the
// default now that candidate-authentication ships real `/auth/*`
// endpoints (design.md Decision 4 of candidate-authentication) — set
// `VITE_AUTH_MODE=mock` to opt back into the fixture adapter (e.g. local
// UI work with no backend running).
import { useSession as useMockSession } from "./useSession.mock"
import { useSession as useLiveSession } from "./useSession.live"
import type { UseSession } from "./useSession.types"

export const useSession: UseSession =
  import.meta.env.VITE_AUTH_MODE === "mock" ? useMockSession : useLiveSession

export type { SessionState, UseSession } from "./useSession.types"

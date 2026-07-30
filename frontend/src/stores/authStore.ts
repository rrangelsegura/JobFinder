import { create } from "zustand"

interface AuthState {
  candidateId: number | null
  email: string | null
  isAuthenticated: boolean
  isLoading: boolean
  setAuthenticated: (candidateId: number, email: string) => void
  setUnauthenticated: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  candidateId: null,
  email: null,
  isAuthenticated: false,
  isLoading: true,
  setAuthenticated: (candidateId, email) =>
    set({ candidateId, email, isAuthenticated: true, isLoading: false }),
  setUnauthenticated: () =>
    set({
      candidateId: null,
      email: null,
      isAuthenticated: false,
      isLoading: false,
    }),
}))

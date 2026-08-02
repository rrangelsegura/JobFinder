export interface SessionState {
  candidateId: number | null
  email: string | null
  emailVerified: boolean | null
  isAuthenticated: boolean
  isLoading: boolean
}

export type UseSession = () => SessionState

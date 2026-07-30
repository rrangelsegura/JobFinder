export interface SessionState {
  candidateId: number | null
  email: string | null
  isAuthenticated: boolean
  isLoading: boolean
}

export type UseSession = () => SessionState

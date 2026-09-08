// cv-upload-tracking-persistence: UploadPage's tracked jobId used to live
// only in component state, so it was lost on every remount (navigating
// away and back, or reloading the page) — see design.md. Scoped per
// candidateId so two candidates sharing a browser never see each other's
// job. Wrapped in try/catch: a private-browsing mode or storage-disabled
// browser should degrade to today's behavior (tracking lost on
// navigation), not crash the page.

function storageKey(candidateId: number): string {
  return `cv-extraction-job:${candidateId}`
}

export function getStoredJobId(candidateId: number): string | null {
  try {
    return localStorage.getItem(storageKey(candidateId))
  } catch {
    return null
  }
}

export function setStoredJobId(candidateId: number, jobId: string): void {
  try {
    localStorage.setItem(storageKey(candidateId), jobId)
  } catch {
    // Storage unavailable — silently no-op, matching getStoredJobId's
    // fallback of "nothing was ever stored".
  }
}

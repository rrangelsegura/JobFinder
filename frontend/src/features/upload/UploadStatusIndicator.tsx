export interface UploadStatusIndicatorProps {
  status: "processing" | "completed" | "failed"
  phase?: "queued" | "extracting" | "saving"
  errorMessage?: string
  durationMs?: number
}

// cv-extraction-progress-phases: phase-specific copy so a candidate isn't
// staring at one static message for the several minutes extraction can
// take. Falls back to the original generic message when phase is absent
// (an old in-flight job, or a backend response that never included it).
const PHASE_COPY: Record<"queued" | "extracting" | "saving", string> = {
  queued: "Waiting to start…",
  extracting: "Analyzing your CV — this can take a few minutes…",
  saving: "Saving your profile…",
}

// cv-extraction-duration: durationMs is total wall-clock time (BullMQ's
// job.finishedOn - job.timestamp), formatted for a non-technical reader.
// Only ever shown on success — design.md decided a failure's duration isn't
// useful to the candidate, so the failure branch never receives it.
function formatDuration(durationMs: number): string {
  const totalSeconds = Math.round(durationMs / 1000)
  if (totalSeconds < 60) {
    return `${totalSeconds} second${totalSeconds === 1 ? "" : "s"}`
  }
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}m ${seconds}s`
}

// specs/cv-upload-ui/spec.md: processing/completed/failed must render
// distinctly (never a blank screen, never indistinguishable states), and a
// failure must show non-technical copy, never the raw backend error.
export function UploadStatusIndicator({
  status,
  phase,
  errorMessage,
  durationMs,
}: UploadStatusIndicatorProps) {
  if (status === "processing") {
    const copy = phase ? PHASE_COPY[phase] : "Processing your CV…"
    return <p role="status">{copy}</p>
  }

  if (status === "completed") {
    return (
      <p role="status">
        Your CV was processed successfully.
        {durationMs !== undefined && ` (took ${formatDuration(durationMs)})`}
      </p>
    )
  }

  return <p role="alert">{errorMessage}</p>
}

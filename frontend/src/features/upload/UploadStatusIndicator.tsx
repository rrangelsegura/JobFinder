export interface UploadStatusIndicatorProps {
  status: "processing" | "completed" | "failed"
  errorMessage?: string
}

// specs/cv-upload-ui/spec.md: processing/completed/failed must render
// distinctly (never a blank screen, never indistinguishable states), and a
// failure must show non-technical copy, never the raw backend error.
export function UploadStatusIndicator({
  status,
  errorMessage,
}: UploadStatusIndicatorProps) {
  if (status === "processing") {
    return <p role="status">Processing your CV…</p>
  }

  if (status === "completed") {
    return <p role="status">Your CV was processed successfully.</p>
  }

  return <p role="alert">{errorMessage}</p>
}

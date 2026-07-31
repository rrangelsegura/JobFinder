// Centralized copy (design.md Decision 3) so the still-open question of the
// target language for user-facing text is a find-and-replace here later,
// not a re-architecture. Keys match the real backend error strings from
// openspec/specs/cv-upload and openspec/specs/cv-extraction.
//
// cv-upload-hardening: file-level problems (wrong type, oversized,
// corrupted) are genuinely the candidate's to fix — those keep telling them
// what to do. OCR and LLM-extraction failures are system-side by
// construction (file-level problems never reach the extraction stage at
// all), so those must never say "try again" — retrying does nothing until
// the actual bug is fixed. The candidate also gets a one-shot
// acknowledgment email (backend/api/lib/emailService.ts,
// sendExtractionFailureEmail) with matching framing.
const ERROR_MESSAGE_RULES: ReadonlyArray<{
  readonly match: string
  readonly message: string
}> = [
  { match: "Unsupported file type", message: "Please upload a PDF file." },
  {
    match: "exceeds the maximum allowed size",
    message: "That file is too large (10MB max).",
  },
  {
    match: "unreadable or corrupted",
    message: "We couldn't read that file — try re-exporting your CV as a PDF.",
  },
  {
    match: "OCR failed",
    message:
      "We ran into a problem reading your CV. This is an issue on our end, not with your file — there's nothing you need to fix. We're already looking into it and will email you as soon as it's resolved so you can upload again.",
  },
  {
    match: "schema validation",
    message:
      "We ran into a problem understanding your CV's content. This is an issue on our end, not with your file — there's nothing you need to fix. We're already looking into it and will email you as soon as it's resolved so you can upload again.",
  },
]

const GENERIC_FAILURE_MESSAGE =
  "Something went wrong processing your CV. This is an issue on our end, not with your file — there's nothing you need to fix. We're already looking into it and will email you as soon as it's resolved so you can upload again."

export function mapExtractionErrorToUserMessage(rawError: string): string {
  const rule = ERROR_MESSAGE_RULES.find((candidate) =>
    rawError.includes(candidate.match),
  )
  return rule ? rule.message : GENERIC_FAILURE_MESSAGE
}

// Centralized copy (design.md Decision 3) so the still-open question of the
// target language for user-facing text is a find-and-replace here later,
// not a re-architecture. Keys match the real backend error strings from
// openspec/specs/cv-upload and openspec/specs/cv-extraction.
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
      "We had trouble reading your CV. Please try again or use a different file.",
  },
  {
    match: "schema validation",
    message:
      "We had trouble understanding your CV's content. Please try again.",
  },
]

const GENERIC_FAILURE_MESSAGE =
  "Something went wrong processing your CV. Please try again."

export function mapExtractionErrorToUserMessage(rawError: string): string {
  const rule = ERROR_MESSAGE_RULES.find((candidate) =>
    rawError.includes(candidate.match),
  )
  return rule ? rule.message : GENERIC_FAILURE_MESSAGE
}

import { mapExtractionErrorToUserMessage } from "./errorMessages"

// Table mirrors design.md Decision 3 exactly, keyed on the real backend
// error substrings documented in openspec/specs/cv-upload and
// cv-extraction.
describe("mapExtractionErrorToUserMessage", () => {
  // File-level problems are genuinely the candidate's to fix — copy
  // unchanged by cv-upload-hardening.
  it.each([
    ["Unsupported file type: text/plain", "Please upload a PDF file."],
    [
      "File exceeds the maximum allowed size of 10MB",
      "That file is too large (10MB max).",
    ],
    [
      "The uploaded file is unreadable or corrupted",
      "We couldn't read that file — try re-exporting your CV as a PDF.",
    ],
  ])("maps %s to the documented friendly message", (rawError, expected) => {
    expect(mapExtractionErrorToUserMessage(rawError)).toBe(expected)
  })

  // cv-upload-hardening: every extraction-stage failure (OCR, LLM schema
  // validation) is system-side — file-level problems are already caught
  // before a job is ever enqueued. These must not say "try again" and must
  // be clear the issue is JobFinder's, not the candidate's file.
  it.each([
    "OCR failed for both Tesseract and Textract",
    "LLM output failed schema validation on both attempts",
    "Something exploded", // unrecognized error falls back to the same honest copy
  ])(
    "does not tell the candidate to just try again for a system-side failure (%s)",
    (rawError) => {
      const message = mapExtractionErrorToUserMessage(rawError)
      expect(message.toLowerCase()).not.toMatch(/try again/)
      expect(message.toLowerCase()).toMatch(
        /on our (end|side)|our (bug|issue|mistake)/,
      )
      expect(message.toLowerCase()).toMatch(/notify|let you know|email you/)
    },
  )
})

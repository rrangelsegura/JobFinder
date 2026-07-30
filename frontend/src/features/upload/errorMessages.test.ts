import { mapExtractionErrorToUserMessage } from "./errorMessages"

// Table mirrors design.md Decision 3 exactly, keyed on the real backend
// error substrings documented in openspec/specs/cv-upload and
// cv-extraction.
describe("mapExtractionErrorToUserMessage", () => {
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
    [
      "OCR failed for both Tesseract and Textract",
      "We had trouble reading your CV. Please try again or use a different file.",
    ],
    [
      "LLM output failed schema validation on both attempts",
      "We had trouble understanding your CV's content. Please try again.",
    ],
  ])("maps %s to the documented friendly message", (rawError, expected) => {
    expect(mapExtractionErrorToUserMessage(rawError)).toBe(expected)
  })

  it("falls back to a generic message for an unrecognized error", () => {
    expect(mapExtractionErrorToUserMessage("Something exploded")).toBe(
      "Something went wrong processing your CV. Please try again.",
    )
  })
})

import { useState, type ChangeEvent, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { useSession } from "@/features/auth/useSession"
import { useCvUpload } from "./useCvUpload"

interface CvUploadFormProps {
  onUploaded: (jobId: string) => void
}

// specs/cv-upload-ui/spec.md "CV Submission from the Upload Section":
// selects and submits a PDF, calling POST /uploads/cv on submit.
export function CvUploadForm({ onUploaded }: CvUploadFormProps) {
  const [file, setFile] = useState<File | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const { candidateId } = useSession()
  const upload = useCvUpload()

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null

    if (selected && selected.type !== "application/pdf") {
      setFile(null)
      setValidationError("Please select a PDF file.")
      return
    }

    setValidationError(null)
    setFile(selected)
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!file || candidateId === null) return

    upload.mutate(
      { file, candidateId },
      { onSuccess: (data) => onUploaded(data.jobId) },
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label htmlFor="cv-file" className="text-sm font-medium">
        CV (PDF)
      </label>
      <input
        id="cv-file"
        type="file"
        accept="application/pdf"
        onChange={handleFileChange}
      />
      {validationError && (
        <p role="alert" className="text-sm text-destructive">
          {validationError}
        </p>
      )}
      <Button type="submit" disabled={!file || upload.isPending}>
        Upload CV
      </Button>
    </form>
  )
}

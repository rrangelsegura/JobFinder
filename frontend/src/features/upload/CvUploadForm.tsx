import { useState, type ChangeEvent, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useCvUpload } from "./useCvUpload"

interface CvUploadFormProps {
  onUploaded: (jobId: string) => void
}

// specs/cv-upload-ui/spec.md "CV Submission from the Upload Section":
// selects and submits a PDF, calling POST /uploads/cv on submit. Only
// rendered inside ProtectedRoute, so the session already exists —
// candidateId is derived server-side (cv-upload delta spec), never sent
// here.
export function CvUploadForm({ onUploaded }: CvUploadFormProps) {
  const [file, setFile] = useState<File | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
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
    if (!file) return

    upload.mutate({ file }, { onSuccess: (data) => onUploaded(data.jobId) })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor="cv-file">CV (PDF)</Label>
        <Input
          id="cv-file"
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
        />
      </div>
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

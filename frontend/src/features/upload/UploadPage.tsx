import { useState } from "react"
import { useSession } from "@/features/auth/useSession"
import { CvUploadForm } from "./CvUploadForm"
import { UploadStatusIndicator } from "./UploadStatusIndicator"
import { useCvExtractionStatus } from "./useCvExtractionStatus"
import { mapExtractionErrorToUserMessage } from "./errorMessages"

export function UploadPage() {
  const [jobId, setJobId] = useState<string | null>(null)
  const { data } = useCvExtractionStatus(jobId)
  const { email: accountEmail } = useSession()

  const extractedEmail =
    data?.status === "completed" ? data.candidate?.personal_info?.email : undefined
  const emailMismatch =
    !!extractedEmail &&
    !!accountEmail &&
    extractedEmail.toLowerCase() !== accountEmail.toLowerCase()

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Upload your CV</h1>
      {!data && <CvUploadForm onUploaded={setJobId} />}
      {data && (
        <UploadStatusIndicator
          status={data.status}
          errorMessage={
            data.status === "failed"
              ? mapExtractionErrorToUserMessage(data.error ?? "")
              : undefined
          }
        />
      )}
      {emailMismatch && (
        <p className="text-sm text-muted-foreground">
          Heads up: your CV lists <strong>{extractedEmail}</strong>, which is
          different from your account email ({accountEmail}). If that's a
          typo, no action is needed — this doesn't change how you log in.
        </p>
      )}
    </div>
  )
}

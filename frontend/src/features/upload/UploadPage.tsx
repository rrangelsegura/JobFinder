import { useState } from "react"
import { CvUploadForm } from "./CvUploadForm"
import { UploadStatusIndicator } from "./UploadStatusIndicator"
import { useCvExtractionStatus } from "./useCvExtractionStatus"
import { mapExtractionErrorToUserMessage } from "./errorMessages"

export function UploadPage() {
  const [jobId, setJobId] = useState<string | null>(null)
  const { data } = useCvExtractionStatus(jobId)

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
    </div>
  )
}

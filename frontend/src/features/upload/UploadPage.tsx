import { useEffect, useState } from "react"
import { useSession } from "@/features/auth/useSession"
import { Card, CardHeader, CardContent } from "@/components/ui/card"
import { CvUploadForm } from "./CvUploadForm"
import { UploadStatusIndicator } from "./UploadStatusIndicator"
import { useCvExtractionStatus } from "./useCvExtractionStatus"
import { mapExtractionErrorToUserMessage } from "./errorMessages"
import { getStoredJobId, setStoredJobId } from "./cvUploadJobStorage"

export function UploadPage() {
  const [jobId, setJobId] = useState<string | null>(null)
  const { data } = useCvExtractionStatus(jobId)
  const { candidateId, email: accountEmail } = useSession()

  // cv-upload-tracking-persistence: without this, navigating away from
  // Upload and back (or reloading the page) loses all track of an
  // in-flight or just-finished job — see design.md. Only reads storage
  // once candidateId resolves, so it never reads an unscoped/wrong key.
  useEffect(() => {
    if (candidateId === null) return
    const storedJobId = getStoredJobId(candidateId)
    if (storedJobId) setJobId(storedJobId)
  }, [candidateId])

  function trackJob(newJobId: string) {
    setJobId(newJobId)
    if (candidateId !== null) setStoredJobId(candidateId, newJobId)
  }

  const extractedEmail =
    data?.status === "completed"
      ? data.candidate?.personal_info?.email
      : undefined
  const emailMismatch =
    !!extractedEmail &&
    !!accountEmail &&
    extractedEmail.toLowerCase() !== accountEmail.toLowerCase()

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <h1 className="text-xl font-semibold">Upload your CV</h1>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {!data && <CvUploadForm onUploaded={trackJob} />}
        {data && (
          <UploadStatusIndicator
            status={data.status}
            phase={data.phase}
            durationMs={data.durationMs}
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
      </CardContent>
    </Card>
  )
}

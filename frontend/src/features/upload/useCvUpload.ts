import { useMutation } from "@tanstack/react-query"
import { apiClient } from "@/lib/apiClient"

export interface UploadAcceptedData {
  resumeId: number
  jobId: string
  status: "processing"
}

interface UploadAcceptedResponse {
  status: "success"
  data: UploadAcceptedData
  agent_trace_id: string
  model_used: string | null
}

export interface UploadCvParams {
  file: File
  candidateId: number
}

// `candidateId` is still sent client-side because the backend contract
// (docs/api-spec.yml, `parse-candidate-cv`) hasn't been updated yet to
// derive it server-side — that fix ships with US-003
// (see design.md Non-Goals).
async function uploadCv({
  file,
  candidateId,
}: UploadCvParams): Promise<UploadAcceptedData> {
  const formData = new FormData()
  formData.append("file", file)
  formData.append("candidateId", String(candidateId))

  const { data } = await apiClient.post<UploadAcceptedResponse>(
    "/uploads/cv",
    formData,
  )
  return data.data
}

export function useCvUpload() {
  return useMutation({ mutationFn: uploadCv })
}

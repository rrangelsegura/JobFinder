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
}

// candidateId is derived server-side from the session (candidate-authentication's
// cv-upload delta spec) — never sent by the client.
async function uploadCv({ file }: UploadCvParams): Promise<UploadAcceptedData> {
  const formData = new FormData()
  formData.append("file", file)

  const { data } = await apiClient.post<UploadAcceptedResponse>(
    "/uploads/cv",
    formData,
  )
  return data.data
}

export function useCvUpload() {
  return useMutation({ mutationFn: uploadCv })
}

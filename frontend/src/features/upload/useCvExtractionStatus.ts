import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/apiClient"

export interface ExtractedCandidate {
  personal_info?: {
    first_name?: string
    last_name?: string
    email?: string
    phone?: string | null
    address?: string | null
  }
}

export interface ExtractionStatusData {
  status: "processing" | "completed" | "failed"
  phase?: "queued" | "extracting" | "saving"
  candidate?: ExtractedCandidate
  error?: string
  durationMs?: number
}

interface ExtractionStatusResponse {
  status: "success"
  data: ExtractionStatusData
  agent_trace_id: string
  model_used: string | null
}

async function fetchExtractionStatus(
  jobId: string,
): Promise<ExtractionStatusData> {
  const { data } = await apiClient.get<ExtractionStatusResponse>(
    `/uploads/cv/${jobId}`,
  )
  return data.data
}

// design.md Decision 2: TanStack Query's own refetchInterval drives polling,
// computed from the last response — 2500ms while processing, stopped
// (`false`) once completed/failed. No manual setInterval/clearInterval.
export function useCvExtractionStatus(jobId: string | null) {
  return useQuery({
    queryKey: ["cv-extraction-status", jobId],
    queryFn: () => fetchExtractionStatus(jobId as string),
    enabled: jobId !== null,
    refetchInterval: (query) =>
      query.state.data?.status === "processing" ? 2500 : false,
  })
}

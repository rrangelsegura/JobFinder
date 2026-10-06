import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/apiClient"
import type { ReplyDraftStatusData } from "./invitationReplyTypes"

interface ReplyDraftStatusResponse {
  status: "success"
  data: ReplyDraftStatusData
  agent_trace_id: string
  model_used: string | null
}

async function fetchReplyDraftStatus(
  jobId: string,
): Promise<ReplyDraftStatusData> {
  const { data } = await apiClient.get<ReplyDraftStatusResponse>(
    `/invitations/reply-drafts/${jobId}`,
  )
  return data.data
}

// Same polling approach as useCvExtractionStatus: refetchInterval computed
// from the last response — 2500ms while processing, stopped once the job
// reaches a terminal state.
export function useReplyDraftStatus(jobId: string | null) {
  return useQuery({
    queryKey: ["invitation-reply-draft", jobId],
    queryFn: () => fetchReplyDraftStatus(jobId as string),
    enabled: jobId !== null,
    refetchInterval: (query) =>
      query.state.data?.status === "processing" ? 2500 : false,
  })
}

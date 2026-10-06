import { useMutation } from "@tanstack/react-query"
import { apiClient } from "@/lib/apiClient"
import type { InvitationIntent } from "./invitationReplyTypes"

export interface CreateReplyDraftParams {
  invitationText: string
  intent: InvitationIntent
}

interface ReplyDraftAcceptedResponse {
  status: "success"
  data: { invitationId: number; jobId: string; status: "processing" }
  agent_trace_id: string
  model_used: string | null
}

// candidateId is derived server-side from the session — never sent here.
async function createReplyDraft(
  params: CreateReplyDraftParams,
): Promise<{ jobId: string }> {
  const { data } = await apiClient.post<ReplyDraftAcceptedResponse>(
    "/invitations/reply-drafts",
    params,
  )
  return { jobId: data.data.jobId }
}

export function useCreateReplyDraft() {
  return useMutation({ mutationFn: createReplyDraft })
}

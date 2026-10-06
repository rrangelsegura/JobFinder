export type InvitationIntent = "interested" | "request_more_info" | "decline"

export const MAX_INVITATION_TEXT_CHARS = 5000

export interface ParsedInvitation {
  recruiterName: string | null
  recruiterTitle: string | null
  company: string | null
  roleTitle: string | null
  location: string | null
  language: string
  callToAction: string | null
}

export type ReplyDraftPhase = "queued" | "parsing" | "drafting" | "saving"

export interface ReplyDraftStatusData {
  status: "processing" | "completed" | "failed"
  phase?: ReplyDraftPhase
  invitation?: ParsedInvitation
  draftReply?: string
  error?: string
  durationMs?: number
}

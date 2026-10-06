import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  MAX_INVITATION_TEXT_CHARS,
  type InvitationIntent,
  type ParsedInvitation,
  type ReplyDraftPhase,
} from "./invitationReplyTypes"
import { useCreateReplyDraft } from "./useCreateReplyDraft"
import { useReplyDraftStatus } from "./useReplyDraftStatus"

const FIELD_CLASSES =
  "w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

const INTENT_OPTIONS: ReadonlyArray<{
  value: InvitationIntent
  label: string
}> = [
  { value: "interested", label: "I'm interested — propose a call" },
  { value: "request_more_info", label: "Ask for more information" },
  { value: "decline", label: "Politely decline" },
]

// One message per real phase the backend reports (queued/parsing/drafting/
// saving), so the wait is never one static line.
const PHASE_COPY: Record<ReplyDraftPhase, string> = {
  queued: "Waiting to start…",
  parsing: "Reading the invitation…",
  drafting: "Writing your reply…",
  saving: "Saving your draft…",
}

const SEND_FAILURE_MESSAGE =
  "We couldn't send your invitation for processing. Please try again."

const SUMMARY_FIELDS: ReadonlyArray<{
  label: string
  key: keyof ParsedInvitation
}> = [
  { label: "Recruiter", key: "recruiterName" },
  { label: "Recruiter title", key: "recruiterTitle" },
  { label: "Company", key: "company" },
  { label: "Role", key: "roleTitle" },
  { label: "Location", key: "location" },
]

function InvitationSummary({ invitation }: { invitation: ParsedInvitation }) {
  // Fields the invitation never stated are omitted, not shown as blanks.
  const rows = SUMMARY_FIELDS.filter(({ key }) => invitation[key])
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
      {rows.map(({ label, key }) => (
        <div key={key} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd>{invitation[key]}</dd>
        </div>
      ))}
    </dl>
  )
}

export function InvitationRepliesPage() {
  const [text, setText] = useState("")
  const [intent, setIntent] = useState<InvitationIntent>("interested")
  const [jobId, setJobId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const create = useCreateReplyDraft()
  const { data } = useReplyDraftStatus(jobId)

  const trimmedLength = text.trim().length
  const tooLong = text.trim().length > MAX_INVITATION_TEXT_CHARS
  const canSubmit = trimmedLength > 0 && !tooLong && !create.isPending

  function submit() {
    create.mutate(
      { invitationText: text, intent },
      { onSuccess: ({ jobId: newJobId }) => setJobId(newJobId) },
    )
  }

  function startOver() {
    setText("")
    setIntent("interested")
    setJobId(null)
    setCopied(false)
    create.reset()
  }

  async function copyDraft(draft: string) {
    await navigator.clipboard.writeText(draft)
    setCopied(true)
  }

  let content
  if (jobId === null) {
    content = (
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          if (canSubmit) submit()
        }}
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="invitation-text">Invitation text</Label>
          <textarea
            id="invitation-text"
            rows={10}
            className={FIELD_CLASSES}
            placeholder="Paste the recruiter's message here"
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            {trimmedLength.toLocaleString("en-US")} /{" "}
            {MAX_INVITATION_TEXT_CHARS.toLocaleString("en-US")} characters
          </p>
          {tooLong && (
            <p role="alert" className="text-sm text-destructive">
              That message is too long. The limit is{" "}
              {MAX_INVITATION_TEXT_CHARS.toLocaleString("en-US")} characters.
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="invitation-intent">What do you want to do?</Label>
          <select
            id="invitation-intent"
            className={FIELD_CLASSES}
            value={intent}
            onChange={(event) =>
              setIntent(event.target.value as InvitationIntent)
            }
          >
            {INTENT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        {create.isError && (
          <p role="alert" className="text-sm text-destructive">
            {SEND_FAILURE_MESSAGE}
          </p>
        )}
        <Button type="submit" disabled={!canSubmit}>
          Draft a reply
        </Button>
      </form>
    )
  } else if (data?.status === "completed" && data.draftReply !== undefined) {
    const draft = data.draftReply
    content = (
      <div className="flex flex-col gap-4">
        {data.invitation && <InvitationSummary invitation={data.invitation} />}
        <div className="flex flex-col gap-2">
          <Label htmlFor="draft-reply">Draft reply</Label>
          <textarea
            id="draft-reply"
            readOnly
            rows={12}
            className={FIELD_CLASSES}
            value={draft}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          This message has not been sent. Please review it and send it yourself
          from your own account.
        </p>
        <div className="flex items-center gap-3">
          <Button onClick={() => copyDraft(draft)}>Copy</Button>
          {copied && <span role="status">Copied to clipboard</span>}
          <Button variant="outline" onClick={startOver}>
            New invitation
          </Button>
        </div>
      </div>
    )
  } else if (data?.status === "failed") {
    content = (
      <div className="flex flex-col gap-4">
        <p role="alert" className="text-sm text-destructive">
          {data.error}
        </p>
        <div className="flex gap-3">
          <Button onClick={submit} disabled={create.isPending}>
            Try again
          </Button>
          <Button variant="outline" onClick={() => setJobId(null)}>
            Edit invitation
          </Button>
        </div>
      </div>
    )
  } else {
    const phase = data?.phase ?? "queued"
    content = <p role="status">{PHASE_COPY[phase]}</p>
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <h1 className="text-xl font-semibold">Reply to a job invitation</h1>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  )
}

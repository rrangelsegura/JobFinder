// Raw worker/agent failure reasons are internal (hostnames, model errors);
// the candidate only ever sees these curated messages. Unlike CV extraction
// failures, every one of these is safe to retry, so the copy says so.
const ERROR_MESSAGE_RULES: ReadonlyArray<{ readonly match: string; readonly message: string }> = [
  {
    match: "schema validation",
    message:
      "We couldn't understand that invitation. Check that you pasted the full message and try again.",
  },
  {
    match: "too-short draft",
    message: "We couldn't write a reply this time. Please try again.",
  },
  {
    match: "unavailable",
    message: "The reply assistant is temporarily unavailable. Please try again in a few minutes.",
  },
];

const GENERIC_FAILURE_MESSAGE = "Something went wrong generating your reply draft. Please try again.";

export function mapInvitationErrorToUserMessage(rawError: string | undefined): string {
  const rule = ERROR_MESSAGE_RULES.find((candidate) => (rawError ?? "").includes(candidate.match));
  return rule ? rule.message : GENERIC_FAILURE_MESSAGE;
}

import { mapInvitationErrorToUserMessage } from "./invitationErrors";

describe("mapInvitationErrorToUserMessage", () => {
  it("explains a schema-validation failure as an unreadable invitation", () => {
    expect(
      mapInvitationErrorToUserMessage("Invitation extraction failed schema validation after one retry: 2 errors"),
    ).toMatch(/understand that invitation/i);
  });

  it("explains an empty draft as a retryable writing failure", () => {
    expect(mapInvitationErrorToUserMessage("The model returned an empty or too-short draft after one retry")).toMatch(
      /write a reply/i,
    );
  });

  it("explains an unreachable language model as temporary", () => {
    expect(mapInvitationErrorToUserMessage("The language model is unavailable.")).toMatch(/temporarily unavailable/i);
  });

  it("falls back to a generic message and never leaks the raw error", () => {
    const message = mapInvitationErrorToUserMessage("ECONNRESET at 10.0.0.5:8000 secret-stack-trace");
    expect(message).toMatch(/something went wrong/i);
    expect(message).not.toContain("10.0.0.5");
  });

  it("handles a missing reason", () => {
    expect(mapInvitationErrorToUserMessage(undefined)).toMatch(/something went wrong/i);
  });
});

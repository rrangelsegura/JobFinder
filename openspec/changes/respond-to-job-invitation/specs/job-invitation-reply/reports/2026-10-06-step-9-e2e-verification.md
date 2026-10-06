# Step 9 Report - E2E Testing in a real browser

- Date: 2026-10-06
- Change: respond-to-job-invitation
- Agent: Claude (Claude Code cloud session)

## Method and limitations
- Real browser (Chromium) driven by the project's `@playwright/test`, against the real running stack (Vite dev server, Node API + worker, Python agent, Postgres, Redis). The Playwright MCP tools named in the project's standards were not available in this session, so the project's own Playwright runner was used instead.
- The sandbox's preinstalled Chromium differs from the version `@playwright/test` pins, so a temporary local config pointed `executablePath` at `/opt/pw-browsers/chromium`. That temporary config was deleted and is not committed.
- **The LLM was the same scripted stub described in the step 8 report** (Ollama is unreachable from this sandbox). Draft text shown in the UI is canned; this verifies the UI, the polling flow and the error handling, not model quality.

## Scenarios
Committed spec: `frontend/e2e/invitation-replies.spec.ts`.

| # | Scenario | Result |
|---|---|---|
| 1 | Register via API, verify via Redis token, log in through the UI, click **Invitation Replies** in the nav | PASS |
| 2 | Submit is disabled with an empty field, enabled once the Baxter invitation is pasted | PASS |
| 3 | Submit; page polls and shows the completed state: parsed summary (Alexis Aguiñaga, Senior Talent Acquisition Consultant, Baxter International Inc., Business Intelligence Specialist, Bogotá, D.C.), a read-only "Draft reply" field, and the notice "This message has not been sent. Please review it and send it yourself from your own account." | PASS |
| 4 | **Copy** puts the exact draft on the clipboard and shows "Copied to clipboard" | PASS |
| 5 | **New invitation** returns to an empty form | PASS |
| 6 | LLM stopped, submit with intent "Ask for more information": page shows the curated error "The reply assistant is temporarily unavailable. Please try again in a few minutes." (no raw error text) | PASS (one-off script, not committed) |
| 7 | LLM restarted, **Try again** resubmits the preserved text and intent: a new job completes and the draft is shown. DB: the failed attempt is `failed`, the retry is `completed`, both `request_more_info` | PASS (one-off script, not committed) |

Screenshot of scenario 3: `2026-10-06-e2e-invitation-draft.png` (same folder).

Not covered end to end: the over-5000-characters limit message (covered by Vitest `InvitationRepliesPage.test.tsx` and by the 400 in the step 8 curl run).

## Cleanup
All test candidates and invitations deleted; DB back to `0 | 0 | 0 | 0 | 0`. Temporary Playwright config and one-off scripts removed.

## Outcome
- Step 9 status: PASS for UI flow; real-LLM behavior NOT VERIFIED (see step 8 report)

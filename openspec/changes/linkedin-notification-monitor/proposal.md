## Why

Recruiters and contacts reach candidates on LinkedIn, but candidates only see those messages when they happen to open the app, so job invitations go unanswered for days. `respond-to-job-invitation` already drafts replies from pasted text and was built with a `source` and an `externalId` so an automated feed could plug in later. This change is that feed: it detects LinkedIn notifications and direct messages on a schedule, classifies them, and alerts the candidate on WhatsApp so a job invitation is noticed and answered quickly.

## What Changes

- A candidate can configure a **LinkedIn monitor** on their profile: an optional LinkedIn profile URL (identity label only), the **connection** that lets JobFinder see their LinkedIn notifications, a **check frequency**, and an on/off switch.
- **Connection method (v1): the candidate's mailbox.** LinkedIn offers no public API to read a member's messages or notifications (the Messages API is restricted to approved partners) and its User Agreement prohibits automated access to the site, so JobFinder does not log in to LinkedIn, scrape it, or store LinkedIn credentials. Instead the candidate connects the mailbox that already receives LinkedIn's e-mail notifications (IMAP, read-only use) and JobFinder detects those e-mails. The source is a pluggable adapter so other methods can be added later.
- A **scheduled check** per candidate runs at the configured frequency (plus a manual "Check now"): it reads new LinkedIn e-mails since the last check, ignores everything else in the mailbox, and de-duplicates by message id.
- Each detected item is **classified** by the local LLM as `social_message` (a contact's simple greeting), `job_invitation`, or `sponsored_message`, with a confidence value. Items the model cannot classify reliably are kept as `uncategorized`. The candidate can correct a category manually.
- **WhatsApp notifications**: the candidate registers a phone number, proves ownership with a verification code (consent), chooses which categories alert them (default: job invitations only), and receives one summary message per check that found something. Message content sent to WhatsApp is minimal by default.
- From a detected `job_invitation` the candidate can **draft a reply** using the existing reply-draft capability (`source` = `linkedin_message`/`linkedin_notification`, `externalId` = the message id).
- A **Settings page** (monitor configuration) and a **Detected notifications** list in the frontend.

## Capabilities

### New Capabilities
- `linkedin-monitor-settings`: per-candidate monitor configuration, mailbox connection with a connection test, check frequency, enable/disable, credential protection.
- `linkedin-notification-detection`: scheduled and on-demand checks, LinkedIn e-mail detection, de-duplication, failure handling, and starting a reply draft from a detected invitation.
- `notification-classification`: classifying a detected item into `social_message`, `job_invitation`, `sponsored_message` (or `uncategorized`), with manual override.
- `whatsapp-notifications`: number registration and verified opt-in, per-category alert preferences, summary delivery and delivery failure handling.
- `linkedin-monitor-ui`: settings page and detected-notifications list.

### Modified Capabilities
(none — the reply-draft behavior is extended inside `linkedin-notification-detection`. It depends on `job-invitation-reply` from the unmerged `respond-to-job-invitation` change, which must land first.)

## Impact

- **Backend Node API**: new routes (`/linkedin-monitor/*`, `/linkedin-notifications/*`, `/whatsapp/*`), a mailbox (IMAP) adapter, a WhatsApp provider adapter, a BullMQ job scheduler and worker, credential encryption helper.
- **Python Agentic Core**: new package `backend/agents/notification_classifier/` (classification only; never touches Postgres).
- **Data model**: new tables `linkedin_monitor_settings` and `linkedin_notifications`; new enums; one new required secret `CREDENTIALS_ENCRYPTION_KEY`; WhatsApp provider env vars.
- **Frontend**: Settings and Detected notifications pages, navigation entries.
- **Docs**: `docs/api-spec.yml`, `docs/data-model.md`, `openspec/config.yaml` (new agent role `notification_classifier`).
- **External dependencies**: an IMAP library, WhatsApp Business Platform (account, approved message template), and sample LinkedIn notification e-mails to build fixtures.
- **Out of scope**: reading LinkedIn directly (API, scraping, browser automation), replying on LinkedIn, sending the drafted reply anywhere, OAuth mailbox connections, quiet hours, WhatsApp as a two-way chat, multiple LinkedIn accounts per candidate.

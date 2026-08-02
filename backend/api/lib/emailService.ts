import nodemailer from "nodemailer";

const EMAIL_FROM = process.env.EMAIL_FROM ?? "JobFinder <no-reply@jobfinder.dev>";
const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:5173";

// candidate-email-verification: defaults to MailDev (localhost:1025, no
// auth) for local dev, unchanged. A real provider (e.g. Resend's SMTP relay)
// is configured purely via env vars — SMTP_HOST/PORT plus SMTP_USER/
// SMTP_PASSWORD for auth — so which transport is active is an environment
// concern, not a code branch. `auth` is only included when credentials are
// actually set, since MailDev rejects auth attempts.
const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? "localhost",
  port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 1025,
  secure: process.env.SMTP_SECURE === "true",
  auth:
    process.env.SMTP_USER && process.env.SMTP_PASSWORD
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
});

// One-shot only (design.md Decision 5): sent once on successful registration,
// never retried or re-sent on a schedule.
export async function sendCvUploadReminderEmail(to: string): Promise<void> {
  await transport.sendMail({
    from: EMAIL_FROM,
    to,
    subject: "Upload your CV to get started on JobFinder",
    text: "Welcome to JobFinder! Upload your CV to complete your profile and start getting matched with job opportunities.",
  });
}

// candidate-email-verification: sent at registration, before the CV-upload
// reminder — the candidate is blocked from everything else until they click
// this link (requireAuth gates on emailVerifiedAt), so this is the one email
// every candidate must actually receive to use the app at all.
export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  const verificationLink = `${FRONTEND_URL}/verify-email?token=${token}`;
  await transport.sendMail({
    from: EMAIL_FROM,
    to,
    subject: "Verify your email for JobFinder",
    text:
      "Welcome to JobFinder! Please verify your email address to activate your account:\n\n" +
      `${verificationLink}\n\n` +
      "This link expires in 48 hours. If you didn't create a JobFinder account, you can ignore this email.",
  });
}

// cv-upload-hardening: every CV extraction job failure is a system-side
// problem (file-level issues are rejected before a job is ever enqueued),
// so this is never the candidate's fault — the copy must not suggest they
// just try again. One-shot acknowledgment, sent immediately on failure;
// there is no automated second email once the underlying bug is actually
// fixed (see design.md Non-Goals).
export async function sendExtractionFailureEmail(to: string): Promise<void> {
  await transport.sendMail({
    from: EMAIL_FROM,
    to,
    subject: "We hit a problem processing your CV",
    text: "We ran into an unexpected problem while processing your CV. This is an issue on our end, not with your file — there's nothing you need to fix. We're already looking into it, and we'll email you as soon as it's resolved so you can try uploading again.",
  });
}

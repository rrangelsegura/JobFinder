import nodemailer from "nodemailer";

const EMAIL_FROM = process.env.EMAIL_FROM ?? "JobFinder <no-reply@jobfinder.dev>";

const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? "localhost",
  port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 1025,
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

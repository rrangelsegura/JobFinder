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

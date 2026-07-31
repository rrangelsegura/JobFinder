import { Job } from "bullmq";
import { prisma } from "../prisma";
import { sendExtractionFailureEmail } from "../lib/emailService";
import { CvExtractionJobData } from "./cvExtractionQueue";

// Every job here is, by construction, a system-side failure (OCR or LLM
// extraction) — file-level problems (wrong type, oversized, corrupted) are
// rejected synchronously at upload time and never reach a BullMQ job at all.
export async function handleExtractionJobFailure(
  job: Job<CvExtractionJobData> | undefined,
  err: Error,
): Promise<void> {
  // eslint-disable-next-line no-console
  console.error(`CV extraction job ${job?.id} failed: ${err.message}`);

  if (!job) return;

  const candidate = await prisma.candidate.findUnique({
    where: { id: job.data.candidateId },
  });
  if (!candidate) return;

  await sendExtractionFailureEmail(candidate.email);
}

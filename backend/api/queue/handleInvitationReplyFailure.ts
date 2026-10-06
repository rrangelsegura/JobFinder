import { Job } from "bullmq";
import { prisma } from "../prisma";
import { InvitationReplyJobData } from "./invitationReplyQueue";

// The record is created as `processing` when the request is accepted; if the
// job dies, leave it as `failed` instead of `processing` forever. The
// `status: "processing"` guard keeps a late failure event from overwriting a
// record that already completed.
export async function handleInvitationReplyJobFailure(
  job: Job<InvitationReplyJobData> | undefined,
  err: Error,
): Promise<void> {
  // eslint-disable-next-line no-console
  console.error(`Invitation reply job ${job?.id} failed: ${err.message}`);

  if (!job) return;

  await prisma.jobInvitation.updateMany({
    where: { id: job.data.invitationId, status: "processing" },
    data: { status: "failed" },
  });
}

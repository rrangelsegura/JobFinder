import { Worker } from "bullmq";
import { INVITATION_REPLY_QUEUE_NAME } from "./invitationReplyQueue";
import { processInvitationReplyJob } from "./invitationReplyProcessor";

const connection = {
  host: process.env.REDIS_HOST ?? "localhost",
  port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379,
};

export function startInvitationReplyWorker(): Worker {
  return new Worker(INVITATION_REPLY_QUEUE_NAME, processInvitationReplyJob, { connection });
}

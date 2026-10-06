import { Queue } from "bullmq";

const connection = {
  host: process.env.REDIS_HOST ?? "localhost",
  port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379,
};

export const INVITATION_REPLY_QUEUE_NAME = "invitation-reply";

export const invitationReplyQueue = new Queue(INVITATION_REPLY_QUEUE_NAME, {
  connection,
});

export type InvitationIntentValue = "interested" | "request_more_info" | "decline";

export interface InvitationReplyJobData {
  invitationId: number;
  candidateId: number;
  invitationText: string;
  intent: InvitationIntentValue;
}

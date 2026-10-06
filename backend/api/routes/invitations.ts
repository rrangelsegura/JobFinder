import { Router, Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { prisma } from "../prisma";
import { requireAuth } from "../middleware/requireAuth";
import {
  invitationReplyQueue,
  InvitationIntentValue,
} from "../queue/invitationReplyQueue";
import { mapInvitationErrorToUserMessage } from "../lib/invitationErrors";

const MAX_INVITATION_TEXT_CHARS = 5000; // specs/job-invitation-reply/spec.md
const INTENTS: readonly InvitationIntentValue[] = ["interested", "request_more_info", "decline"];

export const invitationsRouter = Router();

function badRequest(res: Response, message: string): void {
  res.status(400).json({
    status: "error",
    data: { error: message },
    agent_trace_id: randomUUID(),
    model_used: null,
  });
}

invitationsRouter.post(
  "/invitations/reply-drafts",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { invitationText, intent = "interested" } = (req.body ?? {}) as {
        invitationText?: unknown;
        intent?: unknown;
      };

      if (typeof invitationText !== "string" || invitationText.trim().length === 0) {
        badRequest(res, "invitationText is required and must not be blank.");
        return;
      }
      const text = invitationText.trim();
      if (text.length > MAX_INVITATION_TEXT_CHARS) {
        badRequest(res, `invitationText must be at most ${MAX_INVITATION_TEXT_CHARS} characters.`);
        return;
      }
      if (typeof intent !== "string" || !INTENTS.includes(intent as InvitationIntentValue)) {
        badRequest(res, `intent must be one of: ${INTENTS.join(", ")}.`);
        return;
      }

      // Derived from the authenticated session, never the request body.
      const candidateId = req.candidateId as number;
      const validIntent = intent as InvitationIntentValue;

      const invitation = await prisma.jobInvitation.create({
        data: { candidateId, source: "manual_text", rawText: text, intent: validIntent },
      });

      let job;
      try {
        job = await invitationReplyQueue.add("reply", {
          invitationId: invitation.id,
          candidateId,
          invitationText: text,
          intent: validIntent,
        });
      } catch (err) {
        // Don't leave a record `processing` forever when nothing will ever process it.
        await prisma.jobInvitation.update({ where: { id: invitation.id }, data: { status: "failed" } });
        throw err;
      }

      res.status(202).json({
        status: "success",
        data: { invitationId: invitation.id, jobId: job.id, status: "processing" },
        agent_trace_id: randomUUID(),
        model_used: null,
      });
    } catch (err) {
      next(err);
    }
  },
);

invitationsRouter.get(
  "/invitations/reply-drafts/:jobId",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { jobId } = req.params;
      const job = await invitationReplyQueue.getJob(jobId);

      // A job owned by another candidate is indistinguishable from a missing
      // one: 404, never 403, so job ids can't be probed.
      if (!job || job.data.candidateId !== req.candidateId) {
        res.status(404).json({
          status: "error",
          data: { error: `No reply-draft job found with id ${jobId}.` },
          agent_trace_id: randomUUID(),
          model_used: null,
        });
        return;
      }

      const state = await job.getState();
      const durationMs = (job.finishedOn ?? Date.now()) - job.timestamp;

      if (state === "completed") {
        const { invitation, draftReply } = job.returnvalue as {
          invitation: unknown;
          draftReply: string;
        };
        res.status(200).json({
          status: "success",
          data: { status: "completed", invitation, draftReply, durationMs },
          agent_trace_id: randomUUID(),
          model_used: null,
        });
        return;
      }

      if (state === "failed") {
        res.status(200).json({
          status: "success",
          data: {
            status: "failed",
            error: mapInvitationErrorToUserMessage(job.failedReason),
            durationMs,
          },
          agent_trace_id: randomUUID(),
          model_used: null,
        });
        return;
      }

      // "waiting"/"delayed": no worker has picked it up. Otherwise the worker
      // is running; before its first progress report it is parsing.
      const phase =
        state === "waiting" || state === "delayed"
          ? "queued"
          : ((job.progress as { phase?: string } | undefined)?.phase ?? "parsing");

      res.status(200).json({
        status: "success",
        data: { status: "processing", phase },
        agent_trace_id: randomUUID(),
        model_used: null,
      });
    } catch (err) {
      next(err);
    }
  },
);

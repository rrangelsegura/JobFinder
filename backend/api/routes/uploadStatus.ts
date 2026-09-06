import { Router, Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { cvExtractionQueue } from "../queue/cvExtractionQueue";

export const uploadStatusRouter = Router();

uploadStatusRouter.get(
  "/uploads/cv/:jobId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { jobId } = req.params;
      const job = await cvExtractionQueue.getJob(jobId);

      if (!job) {
        res.status(404).json({
          status: "error",
          data: { error: `No extraction job found with id ${jobId}.` },
          agent_trace_id: randomUUID(),
          model_used: null,
        });
        return;
      }

      const state = await job.getState();

      // cv-extraction-duration: job.timestamp (set when POST /uploads/cv
      // enqueued it) and job.finishedOn (set the moment the worker resolves
      // or rejects) are both already tracked by BullMQ on every job —
      // nothing new to store, just surfacing their difference.
      if (state === "completed") {
        res.status(200).json({
          status: "success",
          data: {
            status: "completed",
            candidate: job.returnvalue,
            durationMs: (job.finishedOn ?? Date.now()) - job.timestamp,
          },
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
            error: job.failedReason,
            durationMs: (job.finishedOn ?? Date.now()) - job.timestamp,
          },
          agent_trace_id: randomUUID(),
          model_used: null,
        });
        return;
      }

      // cv-extraction-progress-phases: "waiting"/"delayed" means the worker
      // hasn't picked this job up yet at all — genuinely queued, not the
      // same as "active" (worker running, progress may or may not be set
      // yet). Any other BullMQ state is still processing.
      const phase =
        state === "waiting" || state === "delayed"
          ? "queued"
          : ((job.progress as { phase?: string } | undefined)?.phase ??
            "extracting");

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

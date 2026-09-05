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

      if (state === "completed") {
        res.status(200).json({
          status: "success",
          data: { status: "completed", candidate: job.returnvalue },
          agent_trace_id: randomUUID(),
          model_used: null,
        });
        return;
      }

      if (state === "failed") {
        res.status(200).json({
          status: "success",
          data: { status: "failed", error: job.failedReason },
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
          : ((job.progress as { phase?: string } | undefined)?.phase ?? "extracting");

      res.status(200).json({
        status: "success",
        data: { status: "processing", phase },
        agent_trace_id: randomUUID(),
        model_used: null,
      });
    } catch (err) {
      next(err);
    }
  }
);

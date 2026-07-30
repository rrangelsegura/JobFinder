import { Worker } from "bullmq";
import { CV_EXTRACTION_QUEUE_NAME } from "./cvExtractionQueue";
import { processCvExtractionJob } from "./cvExtractionProcessor";

const connection = {
  host: process.env.REDIS_HOST ?? "localhost",
  port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379,
};

export function startCvExtractionWorker(): Worker {
  return new Worker(CV_EXTRACTION_QUEUE_NAME, processCvExtractionJob, { connection });
}

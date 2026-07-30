import { Queue } from "bullmq";

const connection = {
  host: process.env.REDIS_HOST ?? "localhost",
  port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379,
};

export const CV_EXTRACTION_QUEUE_NAME = "cv-extraction";

export const cvExtractionQueue = new Queue(CV_EXTRACTION_QUEUE_NAME, {
  connection,
});

export interface CvExtractionJobData {
  resumeId: number;
  candidateId: number;
  filePath: string;
}

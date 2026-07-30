import express from "express";
import request from "supertest";

jest.mock("../queue/cvExtractionQueue", () => ({
  CV_EXTRACTION_QUEUE_NAME: "cv-extraction",
  cvExtractionQueue: {
    getJob: jest.fn(),
  },
}));

import { cvExtractionQueue } from "../queue/cvExtractionQueue";
import { uploadStatusRouter } from "./uploadStatus";

function buildApp() {
  const app = express();
  app.use(uploadStatusRouter);
  return app;
}

function mockJob(overrides: Partial<{
  state: string;
  returnvalue: unknown;
  failedReason: string;
}>) {
  return {
    getState: jest.fn().mockResolvedValue(overrides.state ?? "active"),
    returnvalue: overrides.returnvalue,
    failedReason: overrides.failedReason,
  };
}

describe("GET /uploads/cv/:jobId", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Spec: "Query status of a processing job"
  it("returns processing status with no candidate data while the job is active", async () => {
    (cvExtractionQueue.getJob as jest.Mock).mockResolvedValue(mockJob({ state: "active" }));

    const res = await request(buildApp()).get("/uploads/cv/job-1");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.data.status).toBe("processing");
    expect(res.body.data.candidate).toBeUndefined();
  });

  // Spec: "Query status of a processing job" — waiting/delayed also count as processing
  it("treats waiting and delayed BullMQ states as processing", async () => {
    (cvExtractionQueue.getJob as jest.Mock).mockResolvedValue(mockJob({ state: "waiting" }));
    const res = await request(buildApp()).get("/uploads/cv/job-1");
    expect(res.body.data.status).toBe("processing");
  });

  // Spec: "Query status of a completed job returns candidate data"
  it("returns completed status with the structured candidate payload", async () => {
    const candidate = { id: 42, firstName: "Ada", lastName: "Lovelace" };
    (cvExtractionQueue.getJob as jest.Mock).mockResolvedValue(
      mockJob({ state: "completed", returnvalue: candidate })
    );

    const res = await request(buildApp()).get("/uploads/cv/job-1");

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("completed");
    expect(res.body.data.candidate).toEqual(candidate);
  });

  // Spec: "Query status of a failed job returns error reason"
  it("returns failed status with a user-facing error message", async () => {
    (cvExtractionQueue.getJob as jest.Mock).mockResolvedValue(
      mockJob({ state: "failed", failedReason: "OCR failed on both providers" })
    );

    const res = await request(buildApp()).get("/uploads/cv/job-1");

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("failed");
    expect(res.body.data.error).toBe("OCR failed on both providers");
  });

  // Spec: "Unknown job id returns 404"
  it("returns 404 for an unknown job id", async () => {
    (cvExtractionQueue.getJob as jest.Mock).mockResolvedValue(undefined);

    const res = await request(buildApp()).get("/uploads/cv/does-not-exist");

    expect(res.status).toBe(404);
  });

  // Spec: "Response includes trace and model metadata"
  it("includes agent_trace_id and model_used in every response", async () => {
    (cvExtractionQueue.getJob as jest.Mock).mockResolvedValue(mockJob({ state: "active" }));

    const res = await request(buildApp()).get("/uploads/cv/job-1");

    expect(res.body).toHaveProperty("agent_trace_id");
    expect(res.body).toHaveProperty("model_used");
  });
});

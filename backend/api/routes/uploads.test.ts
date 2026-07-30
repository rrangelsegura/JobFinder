import path from "path";
import { promises as fs } from "fs";
import os from "os";
import request from "supertest";
import express from "express";

const TEST_UPLOAD_DIR = path.join(os.tmpdir(), "jobfinder-uploads-test");
process.env.CV_UPLOAD_DIR = TEST_UPLOAD_DIR;

jest.mock("../prisma", () => ({
  prisma: {
    resume: {
      create: jest.fn(),
    },
  },
}));

jest.mock("../queue/cvExtractionQueue", () => ({
  CV_EXTRACTION_QUEUE_NAME: "cv-extraction",
  cvExtractionQueue: {
    add: jest.fn(),
  },
}));

import { prisma } from "../prisma";
import { cvExtractionQueue } from "../queue/cvExtractionQueue";
import { uploadsRouter } from "./uploads";

const FIXTURES = path.join(__dirname, "__fixtures__");

function buildApp() {
  const app = express();
  app.use(uploadsRouter);
  return app;
}

describe("POST /uploads/cv", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    // uploads.ts writes real files to disk (fs isn't mocked) — clean up the
    // isolated test directory so repeated test runs don't leave PDFs behind.
    await fs.rm(TEST_UPLOAD_DIR, { recursive: true, force: true });
  });

  // Spec: "Valid PDF within size limit is accepted"
  // Spec: "Upload returns 202 with a trackable job id"
  it("accepts a valid PDF and returns 202 with resumeId and jobId", async () => {
    (prisma.resume.create as jest.Mock).mockResolvedValue({
      id: 42,
      filePath: "uploads/valid-cv.pdf",
      fileType: "application/pdf",
      uploadDate: new Date(),
      candidateId: 1,
    });
    (cvExtractionQueue.add as jest.Mock).mockResolvedValue({ id: "job-123" });

    const res = await request(buildApp())
      .post("/uploads/cv")
      .field("candidateId", "1")
      .attach("file", path.join(FIXTURES, "valid-cv.pdf"));

    expect(res.status).toBe(202);
    expect(res.body).toMatchObject({
      status: "success",
      data: {
        resumeId: 42,
        jobId: "job-123",
        status: "processing",
      },
    });
  });

  // Spec: "Resume record created on valid upload"
  it("persists a Resume record with filePath, fileType, uploadDate, candidateId", async () => {
    (prisma.resume.create as jest.Mock).mockResolvedValue({
      id: 42,
      filePath: "uploads/valid-cv.pdf",
      fileType: "application/pdf",
      uploadDate: new Date(),
      candidateId: 1,
    });
    (cvExtractionQueue.add as jest.Mock).mockResolvedValue({ id: "job-123" });

    await request(buildApp())
      .post("/uploads/cv")
      .field("candidateId", "1")
      .attach("file", path.join(FIXTURES, "valid-cv.pdf"));

    expect(prisma.resume.create).toHaveBeenCalledTimes(1);
    const createArgs = (prisma.resume.create as jest.Mock).mock.calls[0][0];
    expect(createArgs.data).toMatchObject({
      fileType: "application/pdf",
      candidateId: 1,
    });
    expect(createArgs.data.filePath).toEqual(expect.any(String));
    expect(createArgs.data.uploadDate).toEqual(expect.any(Date));
  });

  // Spec: "Upload enqueues an async extraction job and returns 202"
  it("enqueues an extraction job referencing the persisted resume", async () => {
    (prisma.resume.create as jest.Mock).mockResolvedValue({
      id: 42,
      filePath: "uploads/valid-cv.pdf",
      fileType: "application/pdf",
      uploadDate: new Date(),
      candidateId: 1,
    });
    (cvExtractionQueue.add as jest.Mock).mockResolvedValue({ id: "job-123" });

    await request(buildApp())
      .post("/uploads/cv")
      .field("candidateId", "1")
      .attach("file", path.join(FIXTURES, "valid-cv.pdf"));

    expect(cvExtractionQueue.add).toHaveBeenCalledTimes(1);
    const [, jobData] = (cvExtractionQueue.add as jest.Mock).mock.calls[0];
    expect(jobData).toMatchObject({ resumeId: 42, candidateId: 1 });
  });

  // Spec: "Non-PDF file is rejected"
  it("rejects a non-PDF file with 400 and does not persist a Resume", async () => {
    const res = await request(buildApp())
      .post("/uploads/cv")
      .field("candidateId", "1")
      .attach("file", path.join(FIXTURES, "resume.docx"));

    expect(res.status).toBe(400);
    expect(prisma.resume.create).not.toHaveBeenCalled();
    expect(cvExtractionQueue.add).not.toHaveBeenCalled();
  });

  // Spec: "Oversized file is rejected"
  it("rejects a file larger than 10MB with 400", async () => {
    const res = await request(buildApp())
      .post("/uploads/cv")
      .field("candidateId", "1")
      .attach("file", path.join(FIXTURES, "oversized-cv.pdf"));

    expect(res.status).toBe(400);
    expect(prisma.resume.create).not.toHaveBeenCalled();
  }, 15000);

  // Spec: "Corrupted PDF rejected at upload"
  it("rejects a corrupted PDF (correct MIME type, invalid content) with a clear error", async () => {
    const res = await request(buildApp())
      .post("/uploads/cv")
      .field("candidateId", "1")
      .attach("file", path.join(FIXTURES, "corrupted-cv.pdf"), {
        contentType: "application/pdf",
      });

    expect(res.status).toBe(400);
    expect(res.body.data?.error ?? res.body.error).toMatch(/corrupt|unreadable/i);
    expect(prisma.resume.create).not.toHaveBeenCalled();
  });

  it("rejects when no file is present", async () => {
    const res = await request(buildApp())
      .post("/uploads/cv")
      .field("candidateId", "1");

    expect(res.status).toBe(400);
  });
});

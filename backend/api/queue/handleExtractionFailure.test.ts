jest.mock("../prisma", () => ({
  prisma: {
    candidate: { findUnique: jest.fn() },
  },
}));

jest.mock("../lib/emailService", () => ({
  sendExtractionFailureEmail: jest.fn().mockResolvedValue(undefined),
}));

import { prisma } from "../prisma";
import { sendExtractionFailureEmail } from "../lib/emailService";
import { handleExtractionJobFailure } from "./handleExtractionFailure";

function buildJob(candidateId = 42) {
  return { id: "job-1", data: { candidateId, resumeId: 7, filePath: "x.pdf" } } as any;
}

describe("handleExtractionJobFailure", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // design.md Decision 3: every job failure is system-side, since file-level
  // problems are rejected before a job is ever enqueued.
  it("emails the candidate exactly once on a job failure", async () => {
    (prisma.candidate.findUnique as jest.Mock).mockResolvedValue({
      id: 42,
      email: "candidate@example.com",
    });

    await handleExtractionJobFailure(buildJob(42), new Error("LLM schema validation failed"));

    expect(prisma.candidate.findUnique).toHaveBeenCalledWith({ where: { id: 42 } });
    expect(sendExtractionFailureEmail).toHaveBeenCalledTimes(1);
    expect(sendExtractionFailureEmail).toHaveBeenCalledWith("candidate@example.com");
  });

  it("does nothing if the job is undefined", async () => {
    await handleExtractionJobFailure(undefined, new Error("boom"));

    expect(prisma.candidate.findUnique).not.toHaveBeenCalled();
    expect(sendExtractionFailureEmail).not.toHaveBeenCalled();
  });

  it("does not throw if the candidate can no longer be found", async () => {
    (prisma.candidate.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      handleExtractionJobFailure(buildJob(42), new Error("boom")),
    ).resolves.not.toThrow();
    expect(sendExtractionFailureEmail).not.toHaveBeenCalled();
  });
});

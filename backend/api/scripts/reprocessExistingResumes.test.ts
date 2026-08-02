jest.mock("../prisma", () => ({
  prisma: { resume: { findMany: jest.fn() } },
}));
jest.mock("../queue/cvExtractionQueue", () => ({
  cvExtractionQueue: { add: jest.fn() },
}));

import { prisma } from "../prisma";
import { cvExtractionQueue } from "../queue/cvExtractionQueue";
import { reprocessExistingResumes } from "./reprocessExistingResumes";

describe("reprocessExistingResumes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (cvExtractionQueue.add as jest.Mock).mockResolvedValue({ id: "job-1" });
  });

  // work-experience-detail: re-enqueues extraction for every already-uploaded
  // resume so existing candidates get the new structured fields retroactively.
  it("enqueues exactly one extraction job per existing resume", async () => {
    (prisma.resume.findMany as jest.Mock).mockResolvedValue([
      { id: 8, candidateId: 10, filePath: "/uploads/cv/a.pdf" },
      { id: 13, candidateId: 15, filePath: "/uploads/cv/b.pdf" },
    ]);

    const count = await reprocessExistingResumes();

    expect(cvExtractionQueue.add).toHaveBeenCalledTimes(2);
    expect(cvExtractionQueue.add).toHaveBeenCalledWith("extract", {
      resumeId: 8,
      candidateId: 10,
      filePath: "/uploads/cv/a.pdf",
    });
    expect(cvExtractionQueue.add).toHaveBeenCalledWith("extract", {
      resumeId: 13,
      candidateId: 15,
      filePath: "/uploads/cv/b.pdf",
    });
    expect(count).toBe(2);
  });

  it("enqueues nothing when there are no existing resumes", async () => {
    (prisma.resume.findMany as jest.Mock).mockResolvedValue([]);

    const count = await reprocessExistingResumes();

    expect(cvExtractionQueue.add).not.toHaveBeenCalled();
    expect(count).toBe(0);
  });
});

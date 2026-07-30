jest.mock("../prisma", () => ({
  prisma: {
    resume: { update: jest.fn() },
    education: { createMany: jest.fn() },
    workExperience: { createMany: jest.fn() },
    skill: { createMany: jest.fn() },
    language: { createMany: jest.fn() },
    certification: { createMany: jest.fn() },
    $transaction: jest.fn(),
  },
}));

import { prisma } from "../prisma";
import { processCvExtractionJob } from "./cvExtractionProcessor";

const SUCCESS_RESPONSE = {
  personal_info: {
    first_name: "Ada",
    last_name: "Lovelace",
    email: "ada@example.com",
    phone: null,
    address: null,
  },
  education: [
    { institution: "Cambridge", title: "Mathematics", start_date: "1840-01-01", end_date: null },
  ],
  work_experience: [
    { company: "Analytical Engines Ltd", position: "Analyst", start_date: "1842-01-01", end_date: null },
  ],
  skills: [{ name: "Python", type: "technical" }],
  languages: [{ name: "English", proficiency: null }],
  certifications: [],
};

function buildJob(overrides: Partial<{ resumeId: number; candidateId: number; filePath: string }> = {}) {
  return {
    data: {
      resumeId: overrides.resumeId ?? 7,
      candidateId: overrides.candidateId ?? 42,
      filePath: overrides.filePath ?? "/uploads/cv/some-resume.pdf",
    },
  } as any;
}

describe("processCvExtractionJob", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.$transaction as jest.Mock).mockResolvedValue([]);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  // Spec: "on a successful Python REST response, Candidate/Education/WorkExperience/
  // Skill/Language/Certification are persisted via Prisma and the job is marked completed"
  it("calls the Python agent with the job data and persists the result via a single transaction", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => SUCCESS_RESPONSE,
    }) as any;

    const result = await processCvExtractionJob(buildJob());

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/cv-analyst/extract"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ resume_id: 7, candidate_id: 42, file_path: "/uploads/cv/some-resume.pdf" }),
      })
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(result).toEqual(SUCCESS_RESPONSE);
  });

  // cv-extraction delta spec: personal info is stored per-resume, never
  // written onto Candidate.{firstName,lastName,email} (Candidate.email is
  // the login credential and must stay independent of resume content).
  it("stores extracted personal info on the resume, not the candidate, and creates related records with the right candidateId", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => SUCCESS_RESPONSE,
    }) as any;

    await processCvExtractionJob(buildJob({ resumeId: 7, candidateId: 42 }));

    expect(prisma.resume.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 7 },
        data: expect.objectContaining({
          extractedFirstName: "Ada",
          extractedLastName: "Lovelace",
          extractedEmail: "ada@example.com",
        }),
      })
    );
    expect(prisma.education.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ institution: "Cambridge", candidateId: 42 })],
      })
    );
    expect(prisma.skill.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: [expect.objectContaining({ name: "Python", candidateId: 42 })] })
    );
  });

  // Spec: sections with no entries shouldn't produce empty createMany calls
  it("skips createMany for sections with no entries (e.g. no certifications found)", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => SUCCESS_RESPONSE, // certifications: []
    }) as any;

    await processCvExtractionJob(buildJob());

    expect(prisma.certification.createMany).not.toHaveBeenCalled();
  });

  // Spec: "on an OCR/LLM failure response from Python, the job is marked failed
  // with the returned reason and no partial data is persisted"
  it("throws with the agent's error reason and never persists anything on OCR/LLM failure", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ detail: { error: "OCR failed on both providers", stage: "ocr" } }),
    }) as any;

    await expect(processCvExtractionJob(buildJob())).rejects.toThrow("OCR failed on both providers");

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.resume.update).not.toHaveBeenCalled();
  });

  it("throws a generic error if the agent response has no parseable error body", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("not json");
      },
    }) as any;

    await expect(processCvExtractionJob(buildJob())).rejects.toThrow(/500/);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

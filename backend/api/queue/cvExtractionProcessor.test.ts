jest.mock("../prisma", () => ({
  prisma: {
    resume: { update: jest.fn() },
    education: { createMany: jest.fn(), deleteMany: jest.fn() },
    workExperience: { create: jest.fn(), deleteMany: jest.fn() },
    workExperienceResponsibility: { createMany: jest.fn() },
    project: { create: jest.fn() },
    projectAchievement: { createMany: jest.fn() },
    projectStackItem: { createMany: jest.fn() },
    skill: { createMany: jest.fn(), deleteMany: jest.fn() },
    language: { createMany: jest.fn(), deleteMany: jest.fn() },
    certification: { createMany: jest.fn(), deleteMany: jest.fn() },
    $transaction: jest.fn(),
  },
}));

import { prisma } from "../prisma";
import { processCvExtractionJob } from "./cvExtractionProcessor";

// The real cvExtractionProcessor.ts uses the interactive transaction form
// (`$transaction(async (tx) => {...})`), not the old sequential-array form —
// tests mock $transaction to invoke the callback with `prisma` itself as
// `tx`, so assertions against `prisma.<model>.<method>` still work.
function mockTransactionInvokesCallbackWithPrismaAsTx() {
  (prisma.$transaction as jest.Mock).mockImplementation(async (callback: (tx: unknown) => unknown) =>
    callback(prisma)
  );
}

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
    {
      company: "Analytical Engines Ltd",
      position: "Analyst",
      start_date: "1842-01-01",
      end_date: null,
      responsibilities: [],
      projects: [],
    },
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
    updateProgress: jest.fn().mockResolvedValue(undefined),
  } as any;
}

describe("processCvExtractionJob", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    mockTransactionInvokesCallbackWithPrismaAsTx();
    (prisma.workExperience.create as jest.Mock).mockImplementation(
      async (args: { data: Record<string, unknown> }) => ({ id: 501, ...args.data })
    );
    (prisma.project.create as jest.Mock).mockImplementation(async (args: { data: Record<string, unknown> }) => ({
      id: 601,
      ...args.data,
    }));
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

  // cv-extraction-progress-phases: the only two real steps this worker goes
  // through, in order, before the agent call and before persistence.
  it("reports progress phases 'extracting' then 'saving' in order", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => SUCCESS_RESPONSE,
    }) as any;
    const job = buildJob();

    await processCvExtractionJob(job);

    expect(job.updateProgress.mock.calls).toEqual([[{ phase: "extracting" }], [{ phase: "saving" }]]);
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

  // cv-extraction-schema-gaps: a real CV stated no start date for an
  // education entry (only a graduation year) — must persist with a NULL
  // startDate rather than failing the transaction.
  it("persists an education entry with no start date as a NULL startDate", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ...SUCCESS_RESPONSE,
        education: [
          { institution: "Coursera", title: "Data Science", start_date: null, end_date: "2020-06-01" },
        ],
      }),
    }) as any;

    await processCvExtractionJob(buildJob());

    expect(prisma.education.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ institution: "Coursera", startDate: null })],
      })
    );
  });

  // work-experience-date-gaps: a real CV stated no start date for a job —
  // must persist with a NULL startDate rather than failing the transaction.
  it("persists a work experience entry with no start date as a NULL startDate", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ...SUCCESS_RESPONSE,
        work_experience: [
          {
            company: "Analytical Engines Ltd",
            position: "Analyst",
            start_date: null,
            end_date: null,
            responsibilities: [],
            projects: [],
          },
        ],
      }),
    }) as any;

    await processCvExtractionJob(buildJob());

    expect(prisma.workExperience.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ company: "Analytical Engines Ltd", startDate: null }),
      })
    );
  });

  // cv-extraction-schema-gaps: a stated proficiency level must persist
  // alongside the skill's type, not be forced into the type field.
  it("persists a skill's proficiency alongside its type", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ...SUCCESS_RESPONSE,
        skills: [{ name: "Scrum", type: "soft", proficiency: "Intermediate" }],
      }),
    }) as any;

    await processCvExtractionJob(buildJob());

    expect(prisma.skill.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ name: "Scrum", type: "soft", proficiency: "Intermediate" })],
      })
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

  // work-experience-detail: responsibilities are role-level, so they persist
  // linked to the WorkExperience row's own generated id.
  it("persists a work experience entry's responsibilities linked to the correct workExperienceId", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ...SUCCESS_RESPONSE,
        work_experience: [
          {
            company: "Analytical Engines Ltd",
            position: "Analyst",
            start_date: "1842-01-01",
            end_date: null,
            responsibilities: ["Designed the analytical engine", "Wrote the first algorithm"],
            projects: [],
          },
        ],
      }),
    }) as any;

    await processCvExtractionJob(buildJob({ candidateId: 42 }));

    expect(prisma.workExperience.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ company: "Analytical Engines Ltd", candidateId: 42 }),
      })
    );
    expect(prisma.workExperienceResponsibility.createMany).toHaveBeenCalledWith({
      data: [
        { text: "Designed the analytical engine", workExperienceId: 501 },
        { text: "Wrote the first algorithm", workExperienceId: 501 },
      ],
    });
  });

  // work-experience-detail: a project's achievements/stack persist linked to
  // the Project row's own generated id, which itself is linked to its parent
  // WorkExperience's generated id — two levels of id-chaining, the reason
  // this needed the interactive transaction form.
  it("persists a work experience entry's projects, achievements, and stack linked to the correct ids", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ...SUCCESS_RESPONSE,
        work_experience: [
          {
            company: "Analytical Engines Ltd",
            position: "Analyst",
            start_date: "1842-01-01",
            end_date: null,
            responsibilities: [],
            projects: [
              {
                name: "Difference Engine Notes",
                description: "Annotated Menabrea's memoir",
                achievements: ["Published the first algorithm intended for a machine"],
                stack: ["Analytical Engine"],
              },
            ],
          },
        ],
      }),
    }) as any;

    await processCvExtractionJob(buildJob());

    expect(prisma.project.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: "Difference Engine Notes", workExperienceId: 501 }),
      })
    );
    expect(prisma.projectAchievement.createMany).toHaveBeenCalledWith({
      data: [{ text: "Published the first algorithm intended for a machine", projectId: 601 }],
    });
    expect(prisma.projectStackItem.createMany).toHaveBeenCalledWith({
      data: [{ name: "Analytical Engine", projectId: 601 }],
    });
  });

  it("creates no responsibility/project rows for a work experience with neither", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => SUCCESS_RESPONSE, // work_experience entry has no responsibilities/projects fields
    }) as any;

    await processCvExtractionJob(buildJob());

    expect(prisma.workExperienceResponsibility.createMany).not.toHaveBeenCalled();
    expect(prisma.project.create).not.toHaveBeenCalled();
    expect(prisma.projectAchievement.createMany).not.toHaveBeenCalled();
    expect(prisma.projectStackItem.createMany).not.toHaveBeenCalled();
  });

  // Atomicity: a failure partway through the transaction must stop
  // subsequent writes from happening at all.
  it("stops persisting further records once a write in the transaction fails", async () => {
    (prisma.workExperience.create as jest.Mock).mockRejectedValue(new Error("db exploded"));
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => SUCCESS_RESPONSE,
    }) as any;

    await expect(processCvExtractionJob(buildJob())).rejects.toThrow("db exploded");

    expect(prisma.skill.createMany).not.toHaveBeenCalled();
    expect(prisma.language.createMany).not.toHaveBeenCalled();
  });

  // work-experience-detail: re-processing replaces a candidate's prior
  // structured data rather than accumulating duplicates (candidateId is the
  // only linking key across resumes today).
  it("deletes the candidate's prior structured records before inserting the fresh extraction", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => SUCCESS_RESPONSE,
    }) as any;

    await processCvExtractionJob(buildJob({ candidateId: 42 }));

    expect(prisma.workExperience.deleteMany).toHaveBeenCalledWith({ where: { candidateId: 42 } });
    expect(prisma.education.deleteMany).toHaveBeenCalledWith({ where: { candidateId: 42 } });
    expect(prisma.skill.deleteMany).toHaveBeenCalledWith({ where: { candidateId: 42 } });
    expect(prisma.language.deleteMany).toHaveBeenCalledWith({ where: { candidateId: 42 } });
    expect(prisma.certification.deleteMany).toHaveBeenCalledWith({ where: { candidateId: 42 } });
  });

  it("never deletes prior records when the agent call itself fails", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ detail: { error: "LLM output failed schema validation after one retry", stage: "llm" } }),
    }) as any;

    await expect(processCvExtractionJob(buildJob())).rejects.toThrow();

    expect(prisma.workExperience.deleteMany).not.toHaveBeenCalled();
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

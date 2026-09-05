import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";

jest.mock("../prisma", () => ({
  prisma: {
    candidate: { findUnique: jest.fn() },
    resume: { findFirst: jest.fn() },
  },
}));

jest.mock("../lib/session", () => ({
  getSession: jest.fn(),
  SESSION_COOKIE_NAME: "jobfinder_session",
}));

import { prisma } from "../prisma";
import { getSession } from "../lib/session";
import { candidatesRouter } from "./candidates";

const AUTH_COOKIE = "jobfinder_session=session-abc";

function buildApp() {
  const app = express();
  app.use(cookieParser());
  app.use(candidatesRouter);
  return app;
}

// requireAuth's own candidate.findUnique check (emailVerifiedAt) is the
// first call in every authenticated request — queue it once here so each
// test only has to set up the second call (the route's own data fetch).
function authenticateAs(candidateId: number) {
  (getSession as jest.Mock).mockResolvedValue({ candidateId });
  (prisma.candidate.findUnique as jest.Mock).mockResolvedValueOnce({
    id: candidateId,
    emailVerifiedAt: new Date(),
  });
}

const SAMPLE_RESUME_WITH_DATA = {
  extractedFirstName: "Ada",
  extractedLastName: "Lovelace",
  extractedEmail: "ada@example.com",
  extractedPhone: null,
  extractedAddress: null,
};

const SAMPLE_CANDIDATE_DATA = {
  educations: [{ id: 1, institution: "Cambridge", title: "Mathematics" }],
  workExperiences: [
    {
      id: 1,
      company: "Analytical Engines Ltd",
      position: "Analyst",
      responsibilities: [{ id: 1, text: "Wrote the first algorithm" }],
      projects: [
        {
          id: 1,
          name: "Analytical Engine Algorithm",
          achievements: [{ id: 1, text: "Implemented it" }],
          stack: [{ id: 1, name: "Unknown" }],
        },
      ],
    },
  ],
  skills: [{ id: 1, name: "Mathematics", type: "technical", proficiency: "Advanced" }],
  languages: [{ id: 1, name: "English", proficiency: "native" }],
  certifications: [{ id: 1, name: "Royal Society Fellow" }],
};

describe("GET /candidates/me", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    (getSession as jest.Mock).mockResolvedValue(null);

    const res = await request(buildApp()).get("/candidates/me").set("Cookie", AUTH_COOKIE);

    expect(res.status).toBe(401);
  });

  it("returns hasAnalysis:false when the candidate has no resumes", async () => {
    authenticateAs(42);
    (prisma.resume.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await request(buildApp()).get("/candidates/me").set("Cookie", AUTH_COOKIE);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ hasAnalysis: false });
  });

  it("returns hasAnalysis:false when the only resume hasn't completed extraction", async () => {
    authenticateAs(42);
    // The query itself filters extractedFirstName: { not: null }, so a
    // resume that's still processing or failed simply isn't returned.
    (prisma.resume.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await request(buildApp()).get("/candidates/me").set("Cookie", AUTH_COOKIE);

    expect(res.body.data).toEqual({ hasAnalysis: false });
    expect(prisma.candidate.findUnique).toHaveBeenCalledTimes(1); // only requireAuth's check, not the full-data fetch
  });

  it("returns hasAnalysis:true with full nested data for a populated candidate", async () => {
    authenticateAs(42);
    (prisma.resume.findFirst as jest.Mock).mockResolvedValue(SAMPLE_RESUME_WITH_DATA);
    (prisma.candidate.findUnique as jest.Mock).mockResolvedValueOnce(SAMPLE_CANDIDATE_DATA);

    const res = await request(buildApp()).get("/candidates/me").set("Cookie", AUTH_COOKIE);

    expect(res.status).toBe(200);
    expect(res.body.data.hasAnalysis).toBe(true);
    expect(res.body.data.personalInfo).toEqual({
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      phone: null,
      address: null,
    });
    expect(res.body.data.education).toEqual(SAMPLE_CANDIDATE_DATA.educations);
    expect(res.body.data.workExperience).toEqual(SAMPLE_CANDIDATE_DATA.workExperiences);
    expect(res.body.data.skills).toEqual(SAMPLE_CANDIDATE_DATA.skills);
    expect(res.body.data.languages).toEqual(SAMPLE_CANDIDATE_DATA.languages);
    expect(res.body.data.certifications).toEqual(SAMPLE_CANDIDATE_DATA.certifications);
  });

  it("selects personal info from the most recent resume with completed extraction", async () => {
    authenticateAs(42);
    (prisma.resume.findFirst as jest.Mock).mockResolvedValue(SAMPLE_RESUME_WITH_DATA);
    (prisma.candidate.findUnique as jest.Mock).mockResolvedValueOnce(SAMPLE_CANDIDATE_DATA);

    await request(buildApp()).get("/candidates/me").set("Cookie", AUTH_COOKIE);

    expect(prisma.resume.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { candidateId: 42, extractedFirstName: { not: null } },
        orderBy: { uploadDate: "desc" },
      })
    );
  });
});

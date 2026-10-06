import { Job } from "bullmq";

jest.mock("../prisma", () => ({
  prisma: {
    candidate: { findUnique: jest.fn() },
    jobInvitation: { update: jest.fn() },
  },
}));

import { prisma } from "../prisma";
import { processInvitationReplyJob } from "./invitationReplyProcessor";
import { InvitationReplyJobData } from "./invitationReplyQueue";

const BAXTER_EXTRACTION = {
  recruiter_name: "Alexis Aguiñaga",
  recruiter_title: "Senior Talent Acquisition Consultant",
  company: "Baxter International Inc.",
  role_title: "Business Intelligence Specialist",
  location: "Bogotá, D.C.",
  language: "en",
  call_to_action: "Reply here or set up a time to talk",
};

const DRAFT = "Hi Alexis, thank you for reaching out about the role at Baxter.";

const JOB_DATA: InvitationReplyJobData = {
  invitationId: 11,
  candidateId: 42,
  invitationText: "Hi Rene, ... Alexis Aguiñaga ...",
  intent: "interested",
};

function mockJob(data: InvitationReplyJobData = JOB_DATA) {
  return { data, updateProgress: jest.fn().mockResolvedValue(undefined) } as unknown as Job<InvitationReplyJobData> & {
    updateProgress: jest.Mock;
  };
}

function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body } as Response;
}

function mockAgent(...responses: Response[]) {
  const fetchMock = jest.fn();
  responses.forEach((r) => fetchMock.mockResolvedValueOnce(r));
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

function mockCandidate(overrides: Record<string, unknown> = {}) {
  (prisma.candidate.findUnique as jest.Mock).mockResolvedValue({
    firstName: "Rene",
    lastName: "Rangel",
    workExperiences: [
      { company: "Johnson & Johnson Innovative Medicine Latinoamérica", position: "Sr. Data Steward" },
      { company: "Globant", position: "Data Engineer" },
      { company: "Globant", position: "Analyst" },
      { company: "Acme Analytics", position: "Junior Analyst" },
    ],
    skills: [
      { name: "Communication", type: "soft" },
      { name: "SQL", type: "technical" },
      { name: "Data Governance", type: "technical" },
    ],
    ...overrides,
  });
}

describe("processInvitationReplyJob", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCandidate();
  });

  // Spec: status phases queued|parsing|drafting|saving
  it("reports the parsing, drafting and saving phases in order", async () => {
    mockAgent(jsonResponse(BAXTER_EXTRACTION), jsonResponse({ draft_reply: DRAFT }));
    const job = mockJob();

    await processInvitationReplyJob(job);

    expect(job.updateProgress.mock.calls.map((c) => c[0])).toEqual([
      { phase: "parsing" },
      { phase: "drafting" },
      { phase: "saving" },
    ]);
  });

  // Spec: completed job returns parsed invitation and draft
  it("returns the parsed invitation in camelCase and the draft reply", async () => {
    mockAgent(jsonResponse(BAXTER_EXTRACTION), jsonResponse({ draft_reply: DRAFT }));

    const result = await processInvitationReplyJob(mockJob());

    expect(result).toEqual({
      invitation: {
        recruiterName: "Alexis Aguiñaga",
        recruiterTitle: "Senior Talent Acquisition Consultant",
        company: "Baxter International Inc.",
        roleTitle: "Business Intelligence Specialist",
        location: "Bogotá, D.C.",
        language: "en",
        callToAction: "Reply here or set up a time to talk",
      },
      draftReply: DRAFT,
    });
  });

  // Spec: persistence of the completed job + diacritics preserved
  it("persists the parsed fields and the draft, preserving diacritics", async () => {
    mockAgent(jsonResponse(BAXTER_EXTRACTION), jsonResponse({ draft_reply: DRAFT }));

    await processInvitationReplyJob(mockJob());

    expect(prisma.jobInvitation.update).toHaveBeenCalledWith({
      where: { id: 11 },
      data: expect.objectContaining({
        status: "completed",
        recruiterName: "Alexis Aguiñaga",
        location: "Bogotá, D.C.",
        company: "Baxter International Inc.",
        roleTitle: "Business Intelligence Specialist",
        draftReply: DRAFT,
      }),
    });
  });

  it("stores null for fields the agent did not extract", async () => {
    mockAgent(
      jsonResponse({ ...BAXTER_EXTRACTION, location: null, call_to_action: null }),
      jsonResponse({ draft_reply: DRAFT }),
    );

    const result = await processInvitationReplyJob(mockJob());

    expect(result.invitation.location).toBeNull();
    expect(prisma.jobInvitation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ location: null, callToAction: null }) }),
    );
  });

  // Spec: grounding — the draft call gets the invitation, parsed data, intent, and a bounded profile summary
  it("sends the invitation text, parsed data, intent and candidate summary to the draft endpoint", async () => {
    const fetchMock = mockAgent(jsonResponse(BAXTER_EXTRACTION), jsonResponse({ draft_reply: DRAFT }));

    await processInvitationReplyJob(mockJob({ ...JOB_DATA, intent: "request_more_info" }));

    const [extractUrl, extractInit] = fetchMock.mock.calls[0];
    expect(extractUrl).toMatch(/\/invitation-responder\/extract$/);
    expect(JSON.parse(extractInit.body)).toEqual({ invitation_text: JOB_DATA.invitationText });

    const [draftUrl, draftInit] = fetchMock.mock.calls[1];
    expect(draftUrl).toMatch(/\/invitation-responder\/draft$/);
    const body = JSON.parse(draftInit.body);
    expect(body.intent).toBe("request_more_info");
    expect(body.invitation_text).toBe(JOB_DATA.invitationText);
    expect(body.invitation).toEqual(BAXTER_EXTRACTION);
    expect(body.candidate).toEqual({
      full_name: "Rene Rangel",
      current_title: "Sr. Data Steward",
      current_company: "Johnson & Johnson Innovative Medicine Latinoamérica",
      previous_companies: ["Globant", "Acme Analytics"],
      top_skills: ["SQL", "Data Governance", "Communication"],
    });
  });

  it("builds a minimal summary for a candidate with no extracted profile", async () => {
    mockCandidate({ workExperiences: [], skills: [] });
    const fetchMock = mockAgent(jsonResponse(BAXTER_EXTRACTION), jsonResponse({ draft_reply: DRAFT }));

    await processInvitationReplyJob(mockJob());

    expect(JSON.parse(fetchMock.mock.calls[1][1].body).candidate).toEqual({
      full_name: "Rene Rangel",
      current_title: null,
      current_company: null,
      previous_companies: [],
      top_skills: [],
    });
  });

  it("fails the job with the agent's own error message when extraction is rejected", async () => {
    mockAgent(jsonResponse({ detail: { error: "failed schema validation after one retry", stage: "extraction" } }, 422));

    await expect(processInvitationReplyJob(mockJob())).rejects.toThrow("failed schema validation after one retry");
    expect(prisma.jobInvitation.update).not.toHaveBeenCalled();
  });

  it("falls back to a generic message when the agent error body is not JSON", async () => {
    mockAgent({ ok: false, status: 500, json: async () => { throw new Error("not json"); } } as unknown as Response);

    await expect(processInvitationReplyJob(mockJob())).rejects.toThrow(/status 500/);
  });

  it("fails when the candidate no longer exists", async () => {
    (prisma.candidate.findUnique as jest.Mock).mockResolvedValue(null);
    mockAgent(jsonResponse(BAXTER_EXTRACTION));

    await expect(processInvitationReplyJob(mockJob())).rejects.toThrow(/candidate/i);
  });
});

import path from "path";
import { readFileSync } from "fs";
import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";

jest.mock("../prisma", () => ({
  prisma: {
    jobInvitation: { create: jest.fn(), update: jest.fn() },
    candidate: { findUnique: jest.fn() },
  },
}));

jest.mock("../queue/invitationReplyQueue", () => ({
  INVITATION_REPLY_QUEUE_NAME: "invitation-reply",
  invitationReplyQueue: { add: jest.fn(), getJob: jest.fn() },
}));

jest.mock("../lib/session", () => ({
  getSession: jest.fn(),
  SESSION_COOKIE_NAME: "jobfinder_session",
}));

import { prisma } from "../prisma";
import { invitationReplyQueue } from "../queue/invitationReplyQueue";
import { getSession } from "../lib/session";
import { invitationsRouter } from "./invitations";

const AUTH_COOKIE = "jobfinder_session=session-abc";
const URL = "/invitations/reply-drafts";

// The reference invitation shared with the Python agent's tests.
const BAXTER_INVITATION = readFileSync(
  path.join(__dirname, "../../agents/invitation_responder/tests/fixtures/baxter_invitation.txt"),
  "utf-8",
);

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(invitationsRouter);
  return app;
}

function authenticateAs(candidateId: number) {
  (getSession as jest.Mock).mockResolvedValue({ candidateId });
  (prisma.candidate.findUnique as jest.Mock).mockResolvedValue({ id: candidateId, emailVerifiedAt: new Date() });
}

describe("POST /invitations/reply-drafts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authenticateAs(42);
    (prisma.jobInvitation.create as jest.Mock).mockResolvedValue({ id: 11 });
    (invitationReplyQueue.add as jest.Mock).mockResolvedValue({ id: "job-7" });
  });

  // Spec: "Valid invitation is accepted for processing"
  it("accepts a valid invitation with 202, a jobId and a manual_text record", async () => {
    const res = await request(buildApp()).post(URL).set("Cookie", AUTH_COOKIE).send({ invitationText: BAXTER_INVITATION });

    expect(res.status).toBe(202);
    expect(res.body.data).toEqual({ invitationId: 11, jobId: "job-7", status: "processing" });
    expect(prisma.jobInvitation.create).toHaveBeenCalledWith({
      data: {
        candidateId: 42,
        source: "manual_text",
        rawText: BAXTER_INVITATION.trim(),
        intent: "interested",
      },
    });
  });

  it("enqueues the job with the trimmed text, the intent and the authenticated candidate", async () => {
    await request(buildApp())
      .post(URL)
      .set("Cookie", AUTH_COOKIE)
      .send({ invitationText: `  ${BAXTER_INVITATION}  `, intent: "decline" });

    expect(invitationReplyQueue.add).toHaveBeenCalledWith("reply", {
      invitationId: 11,
      candidateId: 42,
      invitationText: BAXTER_INVITATION.trim(),
      intent: "decline",
    });
  });

  // Spec: diacritics preserved through the API
  it("preserves diacritics in the stored and enqueued text", async () => {
    await request(buildApp()).post(URL).set("Cookie", AUTH_COOKIE).send({ invitationText: BAXTER_INVITATION });

    const stored = (prisma.jobInvitation.create as jest.Mock).mock.calls[0][0].data.rawText as string;
    expect(stored).toContain("Alexis Aguiñaga");
    expect(stored).toContain("Bogotá, D.C.");
  });

  it("never trusts a candidateId from the request body", async () => {
    await request(buildApp())
      .post(URL)
      .set("Cookie", AUTH_COOKIE)
      .send({ invitationText: "Hello Rene", candidateId: 999 });

    expect((prisma.jobInvitation.create as jest.Mock).mock.calls[0][0].data.candidateId).toBe(42);
  });

  // Spec: "Missing or blank text is rejected"
  it.each([
    ["is missing", {}],
    ["is blank", { invitationText: "   \n  " }],
    ["is not a string", { invitationText: 123 }],
  ])("rejects with 400 when invitationText %s, enqueuing nothing", async (_label, body) => {
    const res = await request(buildApp()).post(URL).set("Cookie", AUTH_COOKIE).send(body);

    expect(res.status).toBe(400);
    expect(res.body.status).toBe("error");
    expect(prisma.jobInvitation.create).not.toHaveBeenCalled();
    expect(invitationReplyQueue.add).not.toHaveBeenCalled();
  });

  // Spec: "Oversized text is rejected" (limit is inclusive at 5000)
  it("rejects text over 5000 characters but accepts exactly 5000", async () => {
    const tooLong = await request(buildApp())
      .post(URL)
      .set("Cookie", AUTH_COOKIE)
      .send({ invitationText: "a".repeat(5001) });
    expect(tooLong.status).toBe(400);
    expect(invitationReplyQueue.add).not.toHaveBeenCalled();

    const atLimit = await request(buildApp())
      .post(URL)
      .set("Cookie", AUTH_COOKIE)
      .send({ invitationText: "a".repeat(5000) });
    expect(atLimit.status).toBe(202);
  });

  // Spec: "Unknown intent is rejected"
  it("rejects an unknown intent with 400", async () => {
    const res = await request(buildApp())
      .post(URL)
      .set("Cookie", AUTH_COOKIE)
      .send({ invitationText: "Hello", intent: "send_it_now" });

    expect(res.status).toBe(400);
    expect(invitationReplyQueue.add).not.toHaveBeenCalled();
  });

  it.each(["interested", "request_more_info", "decline"])("accepts the %s intent", async (intent) => {
    const res = await request(buildApp())
      .post(URL)
      .set("Cookie", AUTH_COOKIE)
      .send({ invitationText: "Hello", intent });

    expect(res.status).toBe(202);
  });

  // Spec: "Unauthenticated request is rejected"
  it("rejects an unauthenticated request with 401", async () => {
    const res = await request(buildApp()).post(URL).send({ invitationText: "Hello" });

    expect(res.status).toBe(401);
    expect(prisma.jobInvitation.create).not.toHaveBeenCalled();
  });

  it("marks the record failed if enqueuing fails after it was created", async () => {
    (invitationReplyQueue.add as jest.Mock).mockRejectedValue(new Error("redis down"));

    const res = await request(buildApp()).post(URL).set("Cookie", AUTH_COOKIE).send({ invitationText: "Hello" });

    expect(res.status).toBe(500);
    expect(prisma.jobInvitation.update).toHaveBeenCalledWith({ where: { id: 11 }, data: { status: "failed" } });
  });
});

function mockJob(
  overrides: Partial<{
    state: string;
    returnvalue: unknown;
    failedReason: string;
    progress: unknown;
    timestamp: number;
    finishedOn: number;
    candidateId: number;
  }>,
) {
  return {
    getState: jest.fn().mockResolvedValue(overrides.state ?? "active"),
    returnvalue: overrides.returnvalue,
    failedReason: overrides.failedReason,
    progress: overrides.progress,
    timestamp: overrides.timestamp ?? 1000,
    finishedOn: overrides.finishedOn,
    data: { candidateId: overrides.candidateId ?? 42 },
  };
}

describe("GET /invitations/reply-drafts/:jobId", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authenticateAs(42);
  });

  // Spec: "Processing job reports its phase"
  it.each(["parsing", "drafting", "saving"])("reports the %s phase while the job runs", async (phase) => {
    (invitationReplyQueue.getJob as jest.Mock).mockResolvedValue(mockJob({ state: "active", progress: { phase } }));

    const res = await request(buildApp()).get(`${URL}/job-7`).set("Cookie", AUTH_COOKIE);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ status: "processing", phase });
  });

  it("reports the queued phase for a job a worker has not picked up", async () => {
    (invitationReplyQueue.getJob as jest.Mock).mockResolvedValue(mockJob({ state: "waiting" }));

    const res = await request(buildApp()).get(`${URL}/job-7`).set("Cookie", AUTH_COOKIE);

    expect(res.body.data).toEqual({ status: "processing", phase: "queued" });
  });

  it("defaults to parsing for an active job that has not reported progress yet", async () => {
    (invitationReplyQueue.getJob as jest.Mock).mockResolvedValue(mockJob({ state: "active" }));

    const res = await request(buildApp()).get(`${URL}/job-7`).set("Cookie", AUTH_COOKIE);

    expect(res.body.data).toEqual({ status: "processing", phase: "parsing" });
  });

  // Spec: "Completed job returns parsed invitation and draft"
  it("returns the parsed invitation, the draft and durationMs for a completed job", async () => {
    const returnvalue = {
      invitation: { recruiterName: "Alexis Aguiñaga", company: "Baxter International Inc.", language: "en" },
      draftReply: "Hi Alexis, thank you.",
    };
    (invitationReplyQueue.getJob as jest.Mock).mockResolvedValue(
      mockJob({ state: "completed", returnvalue, timestamp: 1000, finishedOn: 46675 }),
    );

    const res = await request(buildApp()).get(`${URL}/job-7`).set("Cookie", AUTH_COOKIE);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      status: "completed",
      invitation: returnvalue.invitation,
      draftReply: "Hi Alexis, thank you.",
      durationMs: 45675,
    });
  });

  // Spec: "Failed job returns a user-facing error"
  it("returns a user-facing error and durationMs for a failed job, never the raw reason", async () => {
    (invitationReplyQueue.getJob as jest.Mock).mockResolvedValue(
      mockJob({
        state: "failed",
        failedReason: "Invitation extraction failed schema validation after one retry: 2 errors",
        timestamp: 1000,
        finishedOn: 4000,
      }),
    );

    const res = await request(buildApp()).get(`${URL}/job-7`).set("Cookie", AUTH_COOKIE);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("failed");
    expect(res.body.data.durationMs).toBe(3000);
    expect(res.body.data.error).toMatch(/understand that invitation/i);
    expect(JSON.stringify(res.body)).not.toContain("2 errors");
  });

  it("returns 404 for an unknown job", async () => {
    (invitationReplyQueue.getJob as jest.Mock).mockResolvedValue(undefined);

    const res = await request(buildApp()).get(`${URL}/nope`).set("Cookie", AUTH_COOKIE);

    expect(res.status).toBe(404);
  });

  // Spec: "Another candidate's job is not accessible"
  it("returns 404, not 403, for a job that belongs to a different candidate", async () => {
    (invitationReplyQueue.getJob as jest.Mock).mockResolvedValue(
      mockJob({ state: "completed", candidateId: 7, returnvalue: { draftReply: "private" } }),
    );

    const res = await request(buildApp()).get(`${URL}/job-7`).set("Cookie", AUTH_COOKIE);

    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toContain("private");
  });

  it("rejects an unauthenticated request with 401", async () => {
    const res = await request(buildApp()).get(`${URL}/job-7`);

    expect(res.status).toBe(401);
    expect(invitationReplyQueue.getJob).not.toHaveBeenCalled();
  });
});

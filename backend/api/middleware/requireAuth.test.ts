import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";

jest.mock("../lib/session", () => ({
  getSession: jest.fn(),
  SESSION_COOKIE_NAME: "jobfinder_session",
}));

jest.mock("../prisma", () => ({
  prisma: {
    candidate: {
      findUnique: jest.fn(),
    },
  },
}));

import { getSession, SESSION_COOKIE_NAME } from "../lib/session";
import { prisma } from "../prisma";
import { requireAuth } from "./requireAuth";

function buildApp() {
  const app = express();
  app.use(cookieParser());
  app.get("/protected", requireAuth, (req, res) => {
    res.status(200).json({ candidateId: req.candidateId });
  });
  return app;
}

describe("requireAuth", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("attaches req.candidateId and calls next() for a valid session and a verified candidate", async () => {
    (getSession as jest.Mock).mockResolvedValue({ candidateId: 7 });
    (prisma.candidate.findUnique as jest.Mock).mockResolvedValue({ id: 7, emailVerifiedAt: new Date() });

    const res = await request(buildApp())
      .get("/protected")
      .set("Cookie", `${SESSION_COOKIE_NAME}=session-abc`);

    expect(getSession).toHaveBeenCalledWith("session-abc");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ candidateId: 7 });
  });

  it("responds 401 and never reaches the handler when no cookie is present", async () => {
    const res = await request(buildApp()).get("/protected");

    expect(res.status).toBe(401);
    expect(getSession).not.toHaveBeenCalled();
  });

  it("responds 401 when the session is invalid or expired", async () => {
    (getSession as jest.Mock).mockResolvedValue(null);

    const res = await request(buildApp())
      .get("/protected")
      .set("Cookie", `${SESSION_COOKIE_NAME}=expired-session`);

    expect(res.status).toBe(401);
  });

  // candidate-email-verification: a valid session alone is no longer
  // sufficient — the candidate must have also verified their email.
  it("responds 403 (not 401) when the session is valid but the candidate's email is not verified", async () => {
    (getSession as jest.Mock).mockResolvedValue({ candidateId: 7 });
    (prisma.candidate.findUnique as jest.Mock).mockResolvedValue({ id: 7, emailVerifiedAt: null });

    const res = await request(buildApp())
      .get("/protected")
      .set("Cookie", `${SESSION_COOKIE_NAME}=session-abc`);

    expect(res.status).toBe(403);
  });

  it("does not call the protected handler when the email is unverified", async () => {
    (getSession as jest.Mock).mockResolvedValue({ candidateId: 7 });
    (prisma.candidate.findUnique as jest.Mock).mockResolvedValue({ id: 7, emailVerifiedAt: null });

    const app = express();
    app.use(cookieParser());
    const handler = jest.fn((req, res) => res.status(200).json({ ok: true }));
    app.get("/protected", requireAuth, handler);

    await request(app).get("/protected").set("Cookie", `${SESSION_COOKIE_NAME}=session-abc`);

    expect(handler).not.toHaveBeenCalled();
  });
});

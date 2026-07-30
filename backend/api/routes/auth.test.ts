import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";

jest.mock("../prisma", () => ({
  prisma: {
    candidate: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}));

jest.mock("../lib/emailService", () => ({
  sendCvUploadReminderEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("bcrypt", () => ({
  hash: jest.fn().mockResolvedValue("hashed-password"),
  compare: jest.fn(),
}));

jest.mock("../lib/session", () => ({
  createSession: jest.fn(),
  getSession: jest.fn(),
  deleteSession: jest.fn(),
  SESSION_COOKIE_NAME: "jobfinder_session",
}));

jest.mock("../lib/rateLimiter", () => ({
  checkLoginRateLimit: jest.fn().mockResolvedValue(true),
}));

import bcrypt from "bcrypt";
import { prisma } from "../prisma";
import { sendCvUploadReminderEmail } from "../lib/emailService";
import { createSession, getSession, deleteSession } from "../lib/session";
import { checkLoginRateLimit } from "../lib/rateLimiter";
import { authRouter } from "./auth";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(authRouter);
  return app;
}

describe("POST /auth/register", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Spec: "New candidate registers successfully"
  it("creates a candidate with a bcrypt-hashed password and placeholder name, sends one reminder email", async () => {
    (prisma.candidate.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.candidate.create as jest.Mock).mockResolvedValue({
      id: 7,
      email: "new@example.com",
    });

    const res = await request(buildApp())
      .post("/auth/register")
      .send({ email: "new@example.com", password: "supersecret" });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ candidateId: 7 });
    expect(bcrypt.hash).toHaveBeenCalledWith("supersecret", 12);

    const createArgs = (prisma.candidate.create as jest.Mock).mock.calls[0][0];
    expect(createArgs.data).toMatchObject({
      email: "new@example.com",
      passwordHash: "hashed-password",
    });
    expect(createArgs.data.firstName).toEqual(expect.any(String));
    expect(createArgs.data.lastName).toEqual(expect.any(String));
    expect(createArgs.data.firstName.length).toBeGreaterThan(0);
    expect(createArgs.data.lastName.length).toBeGreaterThan(0);

    expect(sendCvUploadReminderEmail).toHaveBeenCalledTimes(1);
    expect(sendCvUploadReminderEmail).toHaveBeenCalledWith("new@example.com");
  });

  // Spec: "Duplicate email rejected"
  it("rejects a duplicate email with 400 and does not create a candidate", async () => {
    (prisma.candidate.findUnique as jest.Mock).mockResolvedValue({ id: 1 });

    const res = await request(buildApp())
      .post("/auth/register")
      .send({ email: "existing@example.com", password: "supersecret" });

    expect(res.status).toBe(400);
    expect(prisma.candidate.create).not.toHaveBeenCalled();
    expect(sendCvUploadReminderEmail).not.toHaveBeenCalled();
  });

  // Spec: "Weak password rejected"
  it("rejects a password under 8 characters with 400", async () => {
    const res = await request(buildApp())
      .post("/auth/register")
      .send({ email: "new@example.com", password: "short" });

    expect(res.status).toBe(400);
    expect(prisma.candidate.create).not.toHaveBeenCalled();
  });
});

describe("POST /auth/login", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Spec: "Successful login"
  it("creates a session and sets the session cookie on success", async () => {
    (prisma.candidate.findUnique as jest.Mock).mockResolvedValue({
      id: 3,
      email: "candidate@example.com",
      passwordHash: "hashed-password",
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (createSession as jest.Mock).mockResolvedValue("session-abc");

    const res = await request(buildApp())
      .post("/auth/login")
      .send({ email: "candidate@example.com", password: "supersecret" });

    expect(res.status).toBe(200);
    expect(createSession).toHaveBeenCalledWith({ candidateId: 3 });
    const setCookie = res.headers["set-cookie"]?.[0] ?? "";
    expect(setCookie).toContain("jobfinder_session=session-abc");
    expect(setCookie.toLowerCase()).toContain("httponly");
    expect(setCookie.toLowerCase()).toContain("samesite=lax");
  });

  // Spec: "Unknown email rejected generically" / "Wrong password rejected generically"
  it("returns the identical generic 401 for an unknown email and a wrong password", async () => {
    (prisma.candidate.findUnique as jest.Mock).mockResolvedValue(null);
    const unknownEmailRes = await request(buildApp())
      .post("/auth/login")
      .send({ email: "nobody@example.com", password: "supersecret" });

    (prisma.candidate.findUnique as jest.Mock).mockResolvedValue({
      id: 3,
      email: "candidate@example.com",
      passwordHash: "hashed-password",
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    const wrongPasswordRes = await request(buildApp())
      .post("/auth/login")
      .send({ email: "candidate@example.com", password: "wrong-password" });

    expect(unknownEmailRes.status).toBe(401);
    expect(wrongPasswordRes.status).toBe(401);
    expect(unknownEmailRes.body.data.error).toBe(wrongPasswordRes.body.data.error);
    expect(createSession).not.toHaveBeenCalled();
  });

  // design.md Decision 3
  it("rejects with 429 once the login rate limit is exceeded, before checking credentials", async () => {
    (checkLoginRateLimit as jest.Mock).mockResolvedValue(false);

    const res = await request(buildApp())
      .post("/auth/login")
      .send({ email: "candidate@example.com", password: "supersecret" });

    expect(res.status).toBe(429);
    expect(prisma.candidate.findUnique).not.toHaveBeenCalled();
    expect(createSession).not.toHaveBeenCalled();
  });
});

describe("GET /auth/session", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Spec: "Session check succeeds with a valid cookie"
  it("returns the candidate's identity for a valid session cookie", async () => {
    (getSession as jest.Mock).mockResolvedValue({ candidateId: 3 });
    (prisma.candidate.findUnique as jest.Mock).mockResolvedValue({
      id: 3,
      email: "candidate@example.com",
    });

    const res = await request(buildApp())
      .get("/auth/session")
      .set("Cookie", "jobfinder_session=session-abc");

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      candidateId: 3,
      email: "candidate@example.com",
    });
  });

  // Spec: "Session check fails without a valid cookie"
  it("returns 401 when there is no session cookie", async () => {
    const res = await request(buildApp()).get("/auth/session");
    expect(res.status).toBe(401);
  });

  it("returns 401 when the session cookie is invalid or expired", async () => {
    (getSession as jest.Mock).mockResolvedValue(null);

    const res = await request(buildApp())
      .get("/auth/session")
      .set("Cookie", "jobfinder_session=expired-session");

    expect(res.status).toBe(401);
  });
});

describe("POST /auth/logout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Spec: "Logout invalidates the session immediately"
  it("deletes the session and clears the cookie", async () => {
    (deleteSession as jest.Mock).mockResolvedValue(undefined);

    const res = await request(buildApp())
      .post("/auth/logout")
      .set("Cookie", "jobfinder_session=session-abc");

    expect(res.status).toBe(200);
    expect(deleteSession).toHaveBeenCalledWith("session-abc");
    const setCookie = res.headers["set-cookie"]?.[0] ?? "";
    expect(setCookie).toContain("jobfinder_session=;");
  });

  // Spec: "Session cookie is unusable after logout"
  it("a subsequent GET /auth/session with the same cookie returns 401", async () => {
    (deleteSession as jest.Mock).mockResolvedValue(undefined);
    await request(buildApp())
      .post("/auth/logout")
      .set("Cookie", "jobfinder_session=session-abc");

    (getSession as jest.Mock).mockResolvedValue(null);
    const res = await request(buildApp())
      .get("/auth/session")
      .set("Cookie", "jobfinder_session=session-abc");

    expect(res.status).toBe(401);
  });
});

import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";

jest.mock("../prisma", () => ({
  prisma: {
    candidate: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("../lib/emailService", () => ({
  sendCvUploadReminderEmail: jest.fn().mockResolvedValue(undefined),
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../lib/emailVerificationToken", () => ({
  createVerificationToken: jest.fn(),
  consumeVerificationToken: jest.fn(),
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
  checkResendVerificationRateLimit: jest.fn().mockResolvedValue(true),
}));

import bcrypt from "bcrypt";
import { prisma } from "../prisma";
import { sendCvUploadReminderEmail, sendVerificationEmail } from "../lib/emailService";
import { createVerificationToken, consumeVerificationToken } from "../lib/emailVerificationToken";
import { createSession, getSession, deleteSession } from "../lib/session";
import { checkLoginRateLimit, checkResendVerificationRateLimit } from "../lib/rateLimiter";
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
  it("creates a candidate with a bcrypt-hashed password and placeholder name, sends one verification email", async () => {
    (prisma.candidate.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.candidate.create as jest.Mock).mockResolvedValue({
      id: 7,
      email: "new@example.com",
    });
    (createVerificationToken as jest.Mock).mockResolvedValue("the-token");

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
    // emailVerifiedAt is left unset (Prisma default), not explicitly written here

    expect(createVerificationToken).toHaveBeenCalledWith(7);
    expect(sendVerificationEmail).toHaveBeenCalledTimes(1);
    expect(sendVerificationEmail).toHaveBeenCalledWith("new@example.com", "the-token");
  });

  // candidate-email-verification: the CV-upload reminder now fires on
  // verification, not registration — nagging a candidate to upload a CV
  // they're currently blocked from uploading is bad UX.
  it("does not send the CV-upload reminder at registration", async () => {
    (prisma.candidate.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.candidate.create as jest.Mock).mockResolvedValue({ id: 7, email: "new@example.com" });
    (createVerificationToken as jest.Mock).mockResolvedValue("the-token");

    await request(buildApp())
      .post("/auth/register")
      .send({ email: "new@example.com", password: "supersecret" });

    expect(sendCvUploadReminderEmail).not.toHaveBeenCalled();
  });

  // Spec: "Duplicate email rejected"
  it("rejects a duplicate email with 400 and does not create a candidate", async () => {
    (prisma.candidate.findUnique as jest.Mock).mockResolvedValue({ id: 1 });

    const res = await request(buildApp())
      .post("/auth/register")
      .send({ email: "existing@example.com", password: "supersecret" });

    expect(res.status).toBe(400);
    expect(prisma.candidate.create).not.toHaveBeenCalled();
    expect(sendVerificationEmail).not.toHaveBeenCalled();
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

describe("POST /auth/verify-email", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Spec: "Valid token verifies the email"
  it("sets emailVerifiedAt, consumes the token, and sends the CV-upload reminder", async () => {
    (consumeVerificationToken as jest.Mock).mockResolvedValue({ candidateId: 7 });
    (prisma.candidate.update as jest.Mock).mockResolvedValue({
      id: 7,
      email: "new@example.com",
      emailVerifiedAt: new Date(),
    });

    const res = await request(buildApp())
      .post("/auth/verify-email")
      .send({ token: "valid-token" });

    expect(res.status).toBe(200);
    expect(consumeVerificationToken).toHaveBeenCalledWith("valid-token");
    expect(prisma.candidate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 7 },
        data: expect.objectContaining({ emailVerifiedAt: expect.any(Date) }),
      })
    );
    expect(sendCvUploadReminderEmail).toHaveBeenCalledTimes(1);
    expect(sendCvUploadReminderEmail).toHaveBeenCalledWith("new@example.com");
  });

  // Spec: "Expired or unknown token is rejected"
  it("rejects an expired/unknown/already-used token without modifying any candidate", async () => {
    (consumeVerificationToken as jest.Mock).mockResolvedValue(null);

    const res = await request(buildApp())
      .post("/auth/verify-email")
      .send({ token: "bad-token" });

    expect(res.status).toBe(400);
    expect(prisma.candidate.update).not.toHaveBeenCalled();
    expect(sendCvUploadReminderEmail).not.toHaveBeenCalled();
  });
});

describe("POST /auth/resend-verification", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (checkResendVerificationRateLimit as jest.Mock).mockResolvedValue(true);
  });

  // Spec: "Resend issues a new token for an unverified, registered email"
  it("issues a new token and sends a new email for a registered, unverified candidate", async () => {
    (prisma.candidate.findUnique as jest.Mock).mockResolvedValue({
      id: 7,
      email: "new@example.com",
      emailVerifiedAt: null,
    });
    (createVerificationToken as jest.Mock).mockResolvedValue("fresh-token");

    const res = await request(buildApp())
      .post("/auth/resend-verification")
      .send({ email: "new@example.com" });

    expect(res.status).toBe(200);
    expect(createVerificationToken).toHaveBeenCalledWith(7);
    expect(sendVerificationEmail).toHaveBeenCalledWith("new@example.com", "fresh-token");
  });

  // Spec: "Resend does not reveal account existence or verification status"
  it("returns the same generic response for an unregistered email, sending nothing", async () => {
    (prisma.candidate.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await request(buildApp())
      .post("/auth/resend-verification")
      .send({ email: "nobody@example.com" });

    expect(res.status).toBe(200);
    expect(createVerificationToken).not.toHaveBeenCalled();
    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("returns the same generic response for an already-verified email, sending nothing", async () => {
    (prisma.candidate.findUnique as jest.Mock).mockResolvedValue({
      id: 7,
      email: "verified@example.com",
      emailVerifiedAt: new Date(),
    });

    const res = await request(buildApp())
      .post("/auth/resend-verification")
      .send({ email: "verified@example.com" });

    expect(res.status).toBe(200);
    expect(createVerificationToken).not.toHaveBeenCalled();
    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });

  // Spec: "Excessive resend requests are throttled"
  it("rejects with 429 once the resend rate limit is exceeded, before touching the database", async () => {
    (checkResendVerificationRateLimit as jest.Mock).mockResolvedValue(false);

    const res = await request(buildApp())
      .post("/auth/resend-verification")
      .send({ email: "new@example.com" });

    expect(res.status).toBe(429);
    expect(prisma.candidate.findUnique).not.toHaveBeenCalled();
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
      emailVerifiedAt: new Date(),
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

  // candidate-email-verification: login itself is not blocked by
  // verification status — the password was correct, that's real auth. The
  // block happens downstream, in requireAuth.
  it("succeeds and creates a session even for an unverified candidate, reporting emailVerified: false", async () => {
    (prisma.candidate.findUnique as jest.Mock).mockResolvedValue({
      id: 3,
      email: "candidate@example.com",
      passwordHash: "hashed-password",
      emailVerifiedAt: null,
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (createSession as jest.Mock).mockResolvedValue("session-abc");

    const res = await request(buildApp())
      .post("/auth/login")
      .send({ email: "candidate@example.com", password: "supersecret" });

    expect(res.status).toBe(200);
    expect(createSession).toHaveBeenCalledWith({ candidateId: 3 });
    expect(res.body.data.emailVerified).toBe(false);
  });

  it("reports emailVerified: true for a verified candidate", async () => {
    (prisma.candidate.findUnique as jest.Mock).mockResolvedValue({
      id: 3,
      email: "candidate@example.com",
      passwordHash: "hashed-password",
      emailVerifiedAt: new Date(),
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (createSession as jest.Mock).mockResolvedValue("session-abc");

    const res = await request(buildApp())
      .post("/auth/login")
      .send({ email: "candidate@example.com", password: "supersecret" });

    expect(res.body.data.emailVerified).toBe(true);
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
  it("returns the candidate's identity and verification status for a valid session cookie", async () => {
    (getSession as jest.Mock).mockResolvedValue({ candidateId: 3 });
    (prisma.candidate.findUnique as jest.Mock).mockResolvedValue({
      id: 3,
      email: "candidate@example.com",
      emailVerifiedAt: new Date(),
    });

    const res = await request(buildApp())
      .get("/auth/session")
      .set("Cookie", "jobfinder_session=session-abc");

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      candidateId: 3,
      email: "candidate@example.com",
      emailVerified: true,
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

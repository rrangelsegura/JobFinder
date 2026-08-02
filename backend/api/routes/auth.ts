import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import { prisma } from "../prisma";
import { sendCvUploadReminderEmail, sendVerificationEmail } from "../lib/emailService";
import { createVerificationToken, consumeVerificationToken } from "../lib/emailVerificationToken";
import {
  createSession,
  getSession,
  deleteSession,
  SESSION_COOKIE_NAME,
} from "../lib/session";
import { checkLoginRateLimit, checkResendVerificationRateLimit } from "../lib/rateLimiter";

const GENERIC_LOGIN_ERROR = "Invalid email or password";

const BCRYPT_COST_FACTOR = 12;
const MIN_PASSWORD_LENGTH = 8;
// design.md Decision 5: registration doesn't collect a name — the CV
// extraction pipeline overwrites these once the candidate uploads a CV.
const PLACEHOLDER_FIRST_NAME = "New";
const PLACEHOLDER_LAST_NAME = "Candidate";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const authRouter = Router();

authRouter.post("/auth/register", async (req: Request, res: Response) => {
  const { email, password } = req.body ?? {};

  if (typeof email !== "string" || !EMAIL_REGEX.test(email)) {
    res.status(400).json({
      status: "error",
      data: { error: "A valid email is required." },
    });
    return;
  }

  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    res.status(400).json({
      status: "error",
      data: { error: "Password must be at least 8 characters." },
    });
    return;
  }

  const existing = await prisma.candidate.findUnique({ where: { email } });
  if (existing) {
    res.status(400).json({
      status: "error",
      data: { error: "Email already registered." },
    });
    return;
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST_FACTOR);
  const candidate = await prisma.candidate.create({
    data: {
      email,
      passwordHash,
      firstName: PLACEHOLDER_FIRST_NAME,
      lastName: PLACEHOLDER_LAST_NAME,
    },
  });

  // candidate-email-verification: registration only sends the verification
  // link — the CV-upload reminder now fires once that's confirmed (see
  // POST /auth/verify-email below), since the candidate can't upload
  // anything until then.
  const token = await createVerificationToken(candidate.id);
  sendVerificationEmail(email, token).catch((err: unknown) => {
    console.error("Failed to send verification email:", err);
  });

  res.status(201).json({
    status: "success",
    data: { candidateId: candidate.id },
    agent_trace_id: randomUUID(),
    model_used: null,
  });
});

authRouter.post("/auth/verify-email", async (req: Request, res: Response) => {
  const { token } = req.body ?? {};

  if (typeof token !== "string") {
    res.status(400).json({
      status: "error",
      data: { error: "Invalid or expired verification link." },
      agent_trace_id: randomUUID(),
      model_used: null,
    });
    return;
  }

  const data = await consumeVerificationToken(token);
  if (!data) {
    res.status(400).json({
      status: "error",
      data: { error: "Invalid or expired verification link." },
      agent_trace_id: randomUUID(),
      model_used: null,
    });
    return;
  }

  const candidate = await prisma.candidate.update({
    where: { id: data.candidateId },
    data: { emailVerifiedAt: new Date() },
  });

  sendCvUploadReminderEmail(candidate.email).catch((err: unknown) => {
    console.error("Failed to send CV upload reminder email:", err);
  });

  res.status(200).json({
    status: "success",
    data: {},
    agent_trace_id: randomUUID(),
    model_used: null,
  });
});

authRouter.post("/auth/resend-verification", async (req: Request, res: Response) => {
  const { email } = req.body ?? {};

  const genericResponse = {
    status: "success" as const,
    data: { message: "If that email is registered and not yet verified, a new verification link has been sent." },
    agent_trace_id: randomUUID(),
    model_used: null,
  };

  if (typeof email !== "string") {
    res.status(200).json(genericResponse);
    return;
  }

  const allowed = await checkResendVerificationRateLimit(email);
  if (!allowed) {
    res.status(429).json({
      status: "error",
      data: { error: "Too many requests. Please try again later." },
      agent_trace_id: randomUUID(),
      model_used: null,
    });
    return;
  }

  // Anti-enumeration, same principle as generic login failures: whether the
  // email is registered, already verified, or neither, the response is
  // identical — only the side effect (sending a new email) differs.
  const candidate = await prisma.candidate.findUnique({ where: { email } });
  if (candidate && !candidate.emailVerifiedAt) {
    const token = await createVerificationToken(candidate.id);
    sendVerificationEmail(email, token).catch((err: unknown) => {
      console.error("Failed to send verification email:", err);
    });
  }

  res.status(200).json(genericResponse);
});

authRouter.post("/auth/login", async (req: Request, res: Response) => {
  const { email, password } = req.body ?? {};

  // design.md Decision 3: both dimensions, since either alone is bypassable.
  const allowedByIp = await checkLoginRateLimit(`ip:${req.ip}`);
  const allowedByEmail =
    typeof email === "string" ? await checkLoginRateLimit(`email:${email}`) : true;
  if (!allowedByIp || !allowedByEmail) {
    res.status(429).json({
      status: "error",
      data: { error: "Too many login attempts. Please try again later." },
      agent_trace_id: randomUUID(),
      model_used: null,
    });
    return;
  }

  if (typeof email !== "string" || typeof password !== "string") {
    res.status(401).json({
      status: "error",
      data: { error: GENERIC_LOGIN_ERROR },
      agent_trace_id: randomUUID(),
      model_used: null,
    });
    return;
  }

  const candidate = await prisma.candidate.findUnique({ where: { email } });
  const passwordMatches = candidate
    ? await bcrypt.compare(password, candidate.passwordHash)
    : false;

  // Same generic error for unknown email and wrong password — anti-enumeration.
  if (!candidate || !passwordMatches) {
    res.status(401).json({
      status: "error",
      data: { error: GENERIC_LOGIN_ERROR },
      agent_trace_id: randomUUID(),
      model_used: null,
    });
    return;
  }

  const sessionId = await createSession({ candidateId: candidate.id });
  res.cookie(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    // `secure` requires HTTPS; local dev/E2E run over plain http://localhost,
    // where a Secure cookie would never be sent back by a real browser.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7 * 1000,
  });

  res.status(200).json({
    status: "success",
    data: { candidateId: candidate.id, email: candidate.email, emailVerified: Boolean(candidate.emailVerifiedAt) },
    agent_trace_id: randomUUID(),
    model_used: null,
  });
});

authRouter.get("/auth/session", async (req: Request, res: Response) => {
  const sessionId = req.cookies?.[SESSION_COOKIE_NAME];
  const session = sessionId ? await getSession(sessionId) : null;

  if (!session) {
    res.status(401).json({
      status: "error",
      data: { error: "Not authenticated." },
      agent_trace_id: randomUUID(),
      model_used: null,
    });
    return;
  }

  const candidate = await prisma.candidate.findUnique({
    where: { id: session.candidateId },
  });

  if (!candidate) {
    res.status(401).json({
      status: "error",
      data: { error: "Not authenticated." },
      agent_trace_id: randomUUID(),
      model_used: null,
    });
    return;
  }

  res.status(200).json({
    status: "success",
    data: { candidateId: candidate.id, email: candidate.email, emailVerified: Boolean(candidate.emailVerifiedAt) },
    agent_trace_id: randomUUID(),
    model_used: null,
  });
});

authRouter.post("/auth/logout", async (req: Request, res: Response) => {
  const sessionId = req.cookies?.[SESSION_COOKIE_NAME];
  if (sessionId) {
    await deleteSession(sessionId);
  }

  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });

  res.status(200).json({
    status: "success",
    data: {},
    agent_trace_id: randomUUID(),
    model_used: null,
  });
});

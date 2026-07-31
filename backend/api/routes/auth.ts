import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import { prisma } from "../prisma";
import { sendCvUploadReminderEmail } from "../lib/emailService";
import {
  createSession,
  getSession,
  deleteSession,
  SESSION_COOKIE_NAME,
} from "../lib/session";
import { checkLoginRateLimit } from "../lib/rateLimiter";

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

  sendCvUploadReminderEmail(email).catch((err: unknown) => {
    console.error("Failed to send CV upload reminder email:", err);
  });

  res.status(201).json({
    status: "success",
    data: { candidateId: candidate.id },
    agent_trace_id: randomUUID(),
    model_used: null,
  });
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
    data: { candidateId: candidate.id, email: candidate.email },
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
    data: { candidateId: candidate.id, email: candidate.email },
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

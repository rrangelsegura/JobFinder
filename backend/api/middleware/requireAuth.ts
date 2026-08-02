import { Request, Response, NextFunction } from "express";
import { getSession, SESSION_COOKIE_NAME } from "../lib/session";
import { prisma } from "../prisma";

const UNAUTHORIZED_BODY = {
  status: "error" as const,
  data: { error: "Not authenticated." },
};

// Distinct from UNAUTHORIZED_BODY/401: the session is valid (we know who
// this is), they're just not allowed through yet.
const EMAIL_NOT_VERIFIED_BODY = {
  status: "error" as const,
  data: { error: "Email not verified." },
};

// Rejecting before a request body (e.g. a multipart file upload) has been
// read leaves the client mid-write when the response ends. `req.resume()`
// alone isn't enough — it starts draining asynchronously, but the response
// can still finish (and the connection close) before the body fully
// arrives, causing an ECONNRESET on the client. Wait for the drain to
// actually finish first (same class of bug already fixed once in
// uploads.ts, one step further upstream since no parser has touched the
// stream yet here).
function drainRequest(req: Request): Promise<void> {
  return new Promise((resolve) => {
    req.on("end", () => resolve());
    req.on("close", () => resolve());
    req.on("error", () => resolve());
    req.resume();
  });
}

async function rejectUnauthenticated(req: Request, res: Response): Promise<void> {
  await drainRequest(req);
  res.status(401).json(UNAUTHORIZED_BODY);
}

async function rejectUnverified(req: Request, res: Response): Promise<void> {
  await drainRequest(req);
  res.status(403).json(EMAIL_NOT_VERIFIED_BODY);
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const sessionId = req.cookies?.[SESSION_COOKIE_NAME];
  if (!sessionId) {
    await rejectUnauthenticated(req, res);
    return;
  }

  const session = await getSession(sessionId);
  if (!session) {
    await rejectUnauthenticated(req, res);
    return;
  }

  // candidate-email-verification: queried fresh on every request (not
  // cached on the session) so verifying in one tab/session takes effect
  // immediately for any other active session of the same candidate,
  // instead of requiring a fresh login.
  const candidate = await prisma.candidate.findUnique({ where: { id: session.candidateId } });
  if (!candidate || !candidate.emailVerifiedAt) {
    await rejectUnverified(req, res);
    return;
  }

  req.candidateId = session.candidateId;
  next();
}

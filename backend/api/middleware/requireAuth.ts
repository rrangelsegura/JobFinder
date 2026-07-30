import { Request, Response, NextFunction } from "express";
import { getSession, SESSION_COOKIE_NAME } from "../lib/session";

const UNAUTHORIZED_BODY = {
  status: "error" as const,
  data: { error: "Not authenticated." },
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

  req.candidateId = session.candidateId;
  next();
}

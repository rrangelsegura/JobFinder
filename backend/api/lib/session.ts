import { Redis } from "ioredis";
import { randomUUID } from "crypto";

const connection = new Redis({
  host: process.env.REDIS_HOST ?? "localhost",
  port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379,
});

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days, per US-003
export const SESSION_COOKIE_NAME = "jobfinder_session";

export interface SessionData {
  candidateId: number;
}

export async function createSession(data: SessionData): Promise<string> {
  const sessionId = randomUUID();
  await connection.set(
    `session:${sessionId}`,
    JSON.stringify(data),
    "EX",
    SESSION_TTL_SECONDS,
  );
  return sessionId;
}

export async function getSession(
  sessionId: string,
): Promise<SessionData | null> {
  const raw = await connection.get(`session:${sessionId}`);
  return raw ? (JSON.parse(raw) as SessionData) : null;
}

export async function deleteSession(sessionId: string): Promise<void> {
  await connection.del(`session:${sessionId}`);
}

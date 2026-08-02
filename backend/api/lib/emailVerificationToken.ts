import { Redis } from "ioredis";
import { randomUUID } from "crypto";

const connection = new Redis({
  host: process.env.REDIS_HOST ?? "localhost",
  port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379,
});

// design.md: 24-48h window to click the link before having to request a new one.
const VERIFICATION_TOKEN_TTL_SECONDS = 60 * 60 * 48;

export interface VerificationTokenData {
  candidateId: number;
}

// A per-candidate secondary index of "their current token", so a later
// resend can find and invalidate an earlier one (spec: "issues a new
// verification token, invalidating any prior one") — Redis has no reverse
// lookup by value, so this is tracked explicitly rather than scanning keys.
function candidateIndexKey(candidateId: number): string {
  return `email-verify-candidate:${candidateId}`;
}

export async function createVerificationToken(candidateId: number): Promise<string> {
  const priorToken = await connection.get(candidateIndexKey(candidateId));
  if (priorToken) {
    await connection.del(`email-verify:${priorToken}`);
  }

  const token = randomUUID();
  await connection.set(
    `email-verify:${token}`,
    JSON.stringify({ candidateId }),
    "EX",
    VERIFICATION_TOKEN_TTL_SECONDS,
  );
  await connection.set(candidateIndexKey(candidateId), token, "EX", VERIFICATION_TOKEN_TTL_SECONDS);
  return token;
}

// One-time use: looking a token up and invalidating it are the same
// operation, since every real caller (POST /auth/verify-email) only ever
// wants to consume a token once — unlike sessions, there's no repeated
// non-destructive read use case here.
export async function consumeVerificationToken(token: string): Promise<VerificationTokenData | null> {
  const raw = await connection.get(`email-verify:${token}`);
  if (!raw) return null;

  const data = JSON.parse(raw) as VerificationTokenData;
  await connection.del(`email-verify:${token}`);
  await connection.del(candidateIndexKey(data.candidateId));
  return data;
}

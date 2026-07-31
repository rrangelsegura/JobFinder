import { Redis } from "ioredis";

const connection = new Redis({
  host: process.env.REDIS_HOST ?? "localhost",
  port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379,
});

const WINDOW_SECONDS = 60;
const MAX_ATTEMPTS = 5;

// Fixed-window counter (design.md Decision 3). `key` is the caller's choice
// of dimension (IP, email, ...) — /auth/login checks both.
export async function checkLoginRateLimit(key: string): Promise<boolean> {
  const redisKey = `login-attempts:${key}`;
  const count = await connection.incr(redisKey);
  if (count === 1) {
    await connection.expire(redisKey, WINDOW_SECONDS);
  }
  return count <= MAX_ATTEMPTS;
}

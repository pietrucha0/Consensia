import 'server-only';

import { createHash } from 'node:crypto';

import { prisma } from '@/lib/prisma';

type Policy = { limit: number; windowMs: number };

/**
 * Buckets used across the app. Per-IP limits sit on top of the per-account lockout
 * (src/features/auth/credentials.ts): they slow down password spraying across many
 * accounts and email flooding, which a per-account counter cannot see.
 */
export const RATE_LIMITS = {
  signIn: { limit: 20, windowMs: 15 * 60_000 },
  signUp: { limit: 5, windowMs: 60 * 60_000 },
  emailRequest: { limit: 5, windowMs: 15 * 60_000 },
  tokenCheck: { limit: 20, windowMs: 15 * 60_000 },
  passwordChange: { limit: 5, windowMs: 15 * 60_000 },
  upload: { limit: 30, windowMs: 10 * 60_000 },
} as const satisfies Record<string, Policy>;

export type RateLimitBucket = keyof typeof RATE_LIMITS;

/**
 * Counts one attempt and returns false once the bucket is over its limit.
 * Fixed window, stored in Postgres so every app instance shares the counters
 * (no Redis needed at this scale). The subject (IP, user id) is hashed before storage.
 */
export async function consumeRateLimit(bucket: RateLimitBucket, subject: string): Promise<boolean> {
  const { limit, windowMs } = RATE_LIMITS[bucket];
  const key = `${bucket}:${createHash('sha256').update(subject).digest('hex')}`;
  const windowSeconds = windowMs / 1000;

  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "rate_limits" ("key", "count", "windowStart")
    VALUES (${key}, 1, now())
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "rate_limits"."windowStart" <= now() - make_interval(secs => ${windowSeconds}) THEN 1
        ELSE "rate_limits"."count" + 1
      END,
      "windowStart" = CASE
        WHEN "rate_limits"."windowStart" <= now() - make_interval(secs => ${windowSeconds}) THEN now()
        ELSE "rate_limits"."windowStart"
      END
    RETURNING "count"`;

  return (rows[0]?.count ?? 0) <= limit;
}

/** Longest window of any bucket: rows older than this are dead and can be purged. */
export const RATE_LIMIT_MAX_WINDOW_MS = Math.max(...Object.values(RATE_LIMITS).map((p) => p.windowMs));

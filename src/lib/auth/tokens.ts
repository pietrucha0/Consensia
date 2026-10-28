import 'server-only';

import { createHash, randomBytes } from 'node:crypto';

export const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 h
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1 h
/** Minimum gap between two emails of the same kind to the same address. */
export const EMAIL_RESEND_COOLDOWN_MS = 60 * 1000;

/**
 * 256-bit random token. `raw` goes into the email link only;
 * `hash` (SHA-256) is what the database stores, so a DB leak exposes no usable links.
 */
export function generateToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString('base64url');
  return { raw, hash: hashToken(raw) };
}

export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

import 'server-only';

import { headers } from 'next/headers';

/**
 * Client IP as seen by the ONE trusted reverse proxy in front of the app (Caddy, nginx,
 * Vercel…). `X-Real-IP` is set by the proxy itself; otherwise the LAST `X-Forwarded-For`
 * entry is the one our proxy appended — earlier entries come from the client and can be
 * forged. Never expose the Node server directly: a client could then pick its own IP and
 * dodge the per-IP rate limits.
 */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const realIp = h.get('x-real-ip')?.trim();
  if (realIp) return realIp;
  const forwarded = h.get('x-forwarded-for')?.split(',').at(-1)?.trim();
  return forwarded || 'unknown';
}

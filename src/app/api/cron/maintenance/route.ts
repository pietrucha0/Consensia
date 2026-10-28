import { createHash, timingSafeEqual } from 'node:crypto';

import { NextResponse } from 'next/server';

import { env } from '@/env';
import { runMaintenance } from '@/features/maintenance/cleanup';

/**
 * Scheduled housekeeping. Public in the proxy, protected here by a shared secret:
 *   Authorization: Bearer <CRON_SECRET>
 * (the header Vercel Cron sends; any scheduler — cron + curl, a container — can do the same).
 * Without CRON_SECRET configured the endpoint does not exist.
 */
function authorized(request: Request): boolean {
  if (!env.CRON_SECRET) return false;
  const given = request.headers.get('authorization') ?? '';
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(given), digest(`Bearer ${env.CRON_SECRET}`));
}

async function handle(request: Request) {
  if (!env.CRON_SECRET) return new NextResponse(null, { status: 404 });
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const report = await runMaintenance();
  console.info('[maintenance]', report);
  return NextResponse.json({ ok: true, ...report });
}

export const GET = handle;
export const POST = handle;

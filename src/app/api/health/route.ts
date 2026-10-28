import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';

/** Liveness + database check for load balancers and container health checks. Reveals nothing else. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ status: 'unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}

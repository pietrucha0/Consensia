import { getTranslations } from 'next-intl/server';

import { env } from '@/env';
import { getResolutionProtocol } from '@/features/resolutions/queries';
import { isLocale, routing } from '@/i18n/routing';
import { toCsv } from '@/lib/csv';
import { getSessionWithRole } from '@/lib/dal';

/** GET ?locale=pl → the named vote list of a CLOSED resolution as CSV (board only). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getSessionWithRole(['ADMIN', 'MODERATOR']))) return new Response(null, { status: 404 });

  const requested = new URL(request.url).searchParams.get('locale') ?? undefined;
  const locale = isLocale(requested) ? requested : routing.defaultLocale;
  const protocol = await getResolutionProtocol((await params).id, locale);
  if (!protocol) return new Response(null, { status: 404 });

  const t = await getTranslations({ locale, namespace: 'admin.resolutions.protocol' });
  const labelOf = new Map(protocol.options.map((o) => [o.id, o.label]));
  const stamp = new Intl.DateTimeFormat('sv-SE', {
    timeZone: env.APP_TIME_ZONE,
    dateStyle: 'short',
    timeStyle: 'medium',
  });

  const csv = toCsv([
    [t('colMember'), t('colEmail'), t('colChoice'), t('colCastAt')],
    ...protocol.votes.map((v) => [v.name ?? '', v.email, labelOf.get(v.optionId) ?? '', stamp.format(v.castAt)]),
  ]);

  const slug = (protocol.reference ?? protocol.id).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'resolution';
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="votes-${slug}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  });
}

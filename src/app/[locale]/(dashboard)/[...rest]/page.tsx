import { notFound } from 'next/navigation';

import { verifySession } from '@/lib/dal';

/** Unknown paths inside the app: localized 404 within the app shell (after the session check). */
export default async function CatchAllPage() {
  await verifySession();
  notFound();
}

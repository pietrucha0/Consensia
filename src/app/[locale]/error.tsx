'use client';

import { ErrorScreen } from '@/components/layout/error-screen';

/** Errors in the app shell itself or the auth pages. */
export default function LocaleError(props: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="px-4">
      <ErrorScreen {...props} />
    </main>
  );
}

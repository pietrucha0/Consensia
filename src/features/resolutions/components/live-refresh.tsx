'use client';

import { useEffect } from 'react';

import { useRouter } from '@/i18n/navigation';

/** Re-renders the page from the server every `intervalMs` while the tab is visible (live results). */
export function LiveRefresh({ intervalMs = 20_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs, router]);

  return null;
}

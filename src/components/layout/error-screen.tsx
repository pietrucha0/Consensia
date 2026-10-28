'use client';

import { TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

import { StatusMessage } from '@/components/layout/status-message';
import { Button } from '@/components/ui/button';

type Props = { error: Error & { digest?: string }; retry: () => void };

/**
 * Body of the error boundaries. In production Server Component errors reach the client as
 * a generic message plus `digest`, which matches the server log line — shown so a member
 * can quote it to the administrator.
 */
export function ErrorScreen({ error, retry }: Props) {
  const t = useTranslations('errors.failure');

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusMessage icon={TriangleAlert} title={t('title')} description={t('description')}>
      <Button onClick={() => retry()}>{t('retry')}</Button>
      {error.digest && (
        <p className="basis-full pt-2 text-xs text-muted-foreground">
          {t('reference')} <code className="font-mono">{error.digest}</code>
        </p>
      )}
    </StatusMessage>
  );
}

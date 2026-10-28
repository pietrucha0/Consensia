import { FileQuestion } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { StatusMessage } from '@/components/layout/status-message';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

/** 404 outside the app shell (public auth area). */
export default async function LocaleNotFound() {
  const t = await getTranslations('errors.notFound');
  return (
    <main className="px-4">
      <StatusMessage icon={FileQuestion} title={t('title')} description={t('description')}>
        <title>{`${t('title')} · Consensia`}</title>
        <Button asChild>
          <Link href="/">{t('home')}</Link>
        </Button>
      </StatusMessage>
    </main>
  );
}

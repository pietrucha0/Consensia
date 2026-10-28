import { FileQuestion } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { StatusMessage } from '@/components/layout/status-message';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

export default async function DashboardNotFound() {
  const t = await getTranslations('errors.notFound');
  return (
    <StatusMessage icon={FileQuestion} title={t('title')} description={t('description')}>
        <title>{`${t('title')} · Consensia`}</title>
      <Button asChild>
        <Link href="/">{t('home')}</Link>
      </Button>
      <Button asChild variant="outline">
        <Link href="/resolutions">{t('resolutions')}</Link>
      </Button>
    </StatusMessage>
  );
}

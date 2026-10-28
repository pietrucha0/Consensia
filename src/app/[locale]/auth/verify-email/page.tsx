import { CircleAlert } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { AuthCard } from '@/features/auth/components/auth-card';
import { VerifyEmailForm } from '@/features/auth/components/verify-email-form';
import { Link } from '@/i18n/navigation';
import { firstParam, type SearchParams } from '@/lib/search-params';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.verifyEmail');
  return { title: t('title') };
}

export default async function VerifyEmailPage({ searchParams }: { searchParams: SearchParams }) {
  const token = firstParam((await searchParams).token);
  const t = await getTranslations('auth.verifyEmail');
  const tCommon = await getTranslations('common');

  return (
    <AuthCard
      title={t('title')}
      description={token ? t('body') : undefined}
      footer={
        <Link href="/auth/signin" className="font-medium text-primary underline-offset-4 hover:underline">
          {tCommon('backToSignIn')}
        </Link>
      }
    >
      {token ? (
        <VerifyEmailForm token={token} />
      ) : (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertDescription>{t('missingToken')}</AlertDescription>
        </Alert>
      )}
    </AuthCard>
  );
}

import { CircleAlert } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { AuthCard } from '@/features/auth/components/auth-card';
import { ResetPasswordForm } from '@/features/auth/components/reset-password-form';
import { Link } from '@/i18n/navigation';
import { firstParam, type SearchParams } from '@/lib/search-params';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.resetPassword');
  return { title: t('title') };
}

export default async function ResetPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  const token = firstParam((await searchParams).token);
  const t = await getTranslations('auth.resetPassword');
  const tCommon = await getTranslations('common');

  return (
    <AuthCard
      title={t('title')}
      description={token ? t('subtitle') : undefined}
      footer={
        <Link href="/auth/signin" className="font-medium text-primary underline-offset-4 hover:underline">
          {tCommon('backToSignIn')}
        </Link>
      }
    >
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertDescription>
            <p>{t('missingToken')}</p>
            <Link href="/auth/forgot-password" className="font-medium underline underline-offset-4">
              {t('requestNew')}
            </Link>
          </AlertDescription>
        </Alert>
      )}
    </AuthCard>
  );
}

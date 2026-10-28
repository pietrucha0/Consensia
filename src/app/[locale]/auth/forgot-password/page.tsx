import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { AuthCard } from '@/features/auth/components/auth-card';
import { ForgotPasswordForm } from '@/features/auth/components/forgot-password-form';
import { Link } from '@/i18n/navigation';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.forgotPassword');
  return { title: t('title') };
}

export default async function ForgotPasswordPage() {
  const t = await getTranslations('auth.forgotPassword');
  const tCommon = await getTranslations('common');

  return (
    <AuthCard
      title={t('title')}
      description={t('subtitle')}
      footer={
        <Link href="/auth/signin" className="font-medium text-primary underline-offset-4 hover:underline">
          {tCommon('backToSignIn')}
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}

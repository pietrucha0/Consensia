import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { AuthCard } from '@/features/auth/components/auth-card';
import { SignUpForm } from '@/features/auth/components/sign-up-form';
import { Link } from '@/i18n/navigation';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.signUp');
  return { title: t('title') };
}

export default async function SignUpPage() {
  const t = await getTranslations('auth.signUp');

  return (
    <AuthCard
      title={t('title')}
      description={t('subtitle')}
      footer={
        <>
          {t('haveAccount')}{' '}
          <Link href="/auth/signin" className="font-medium text-primary underline-offset-4 hover:underline">
            {t('signInLink')}
          </Link>
        </>
      }
    >
      <SignUpForm />
    </AuthCard>
  );
}

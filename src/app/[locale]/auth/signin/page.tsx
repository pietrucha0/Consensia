import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { AuthCard } from '@/features/auth/components/auth-card';
import { SignInForm } from '@/features/auth/components/sign-in-form';
import { Link } from '@/i18n/navigation';
import { firstParam, type SearchParams } from '@/lib/search-params';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.signIn');
  return { title: t('title') };
}

export default async function SignInPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const t = await getTranslations('auth.signIn');

  const notice = firstParam(params.verified) === '1' ? 'verified' : firstParam(params.reset) === '1' ? 'reset' : undefined;

  return (
    <AuthCard
      title={t('title')}
      description={t('subtitle')}
      footer={
        <>
          {t('noAccount')}{' '}
          <Link href="/auth/signup" className="font-medium text-primary underline-offset-4 hover:underline">
            {t('signUpLink')}
          </Link>
        </>
      }
    >
      {/* callbackUrl is re-validated server-side by safeCallbackUrl() */}
      <SignInForm callbackUrl={firstParam(params.callbackUrl)} notice={notice} />
    </AuthCard>
  );
}

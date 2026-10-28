import { Suspense, type ReactNode } from 'react';

import { LocaleSwitcher } from '@/components/layout/locale-switcher';
import { Logo } from '@/components/layout/logo';
import { redirect } from '@/i18n/navigation';
import { isLocale, routing } from '@/i18n/routing';
import { getSession } from '@/lib/dal';

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

/** Public auth area. Signed-in users (validated against the DB, not just the cookie) go home. */
export default async function AuthLayout({ children, params }: Props) {
  const { locale } = await params;
  if (await getSession()) {
    redirect({ href: '/', locale: isLocale(locale) ? locale : routing.defaultLocale });
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex justify-end p-4">
        <Suspense>
          <LocaleSwitcher />
        </Suspense>
      </header>
      <main className="flex flex-1 justify-center px-4 pt-4 pb-16 sm:items-center sm:pt-0">
        <div className="w-full max-w-md">
          <div className="mb-8 flex justify-center">
            <Logo />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

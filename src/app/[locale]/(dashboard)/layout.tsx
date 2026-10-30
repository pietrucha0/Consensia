import { CircleUserRound, LogOut } from 'lucide-react';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { Suspense, type ReactNode } from 'react';

import { LocaleSwitcher } from '@/components/layout/locale-switcher';
import { Logo } from '@/components/layout/logo';
import { MainNav, type NavItem } from '@/components/layout/main-nav';
import { Button } from '@/components/ui/button';
import { signOutAction } from '@/features/auth/actions';
import { Link } from '@/i18n/navigation';
import { isLocale, routing } from '@/i18n/routing';
import { verifySession } from '@/lib/dal';

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

/** App shell. Pages below must still call verifySession() — layouts don't re-run on client navigation. */
export default async function DashboardLayout({ children, params }: Props) {
  const session = await verifySession();
  const { locale } = await params;
  const t = await getTranslations();

  const isEditor = session.user.role === 'ADMIN' || session.user.role === 'MODERATOR';
  const navItems: NavItem[] = [
    { href: '/', label: t('nav.articles'), alsoActiveOn: ['/articles'] },
    { href: '/resolutions', label: t('nav.resolutions') },
  ];
  if (isEditor) navItems.push({ href: '/admin/resolutions', label: t('nav.adminResolutions') });
  if (session.user.role === 'ADMIN') {
    navItems.push(
      { href: '/admin/articles', label: t('nav.adminArticles') },
      { href: '/admin/users', label: t('nav.adminUsers') },
      { href: '/admin/audit', label: t('nav.adminAudit') },
    );
  }

  // Client components get every namespace except the admin UI, which only editors receive.
  const messages = await getMessages();
  const clientMessages = isEditor ? messages : Object.fromEntries(Object.entries(messages).filter(([ns]) => ns !== 'admin'));

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b bg-card">
        {/* Two rows: the admin navigation is too long to share a row with the account controls. */}
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 pt-3 pb-2">
          <Link href="/" aria-label="Consensia" className="shrink-0">
            <Logo />
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            {/* On phones the language switcher moves to the second row to leave room here. */}
            <div className="hidden sm:block">
              <Suspense>
                <LocaleSwitcher />
              </Suspense>
            </div>
            <Link
              href="/account"
              title={t('nav.account')}
              className="flex items-center gap-2 rounded-md px-2 py-1 text-sm leading-tight hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/30 focus-visible:outline-none"
            >
              <CircleUserRound className="size-5 text-muted-foreground sm:hidden" aria-hidden />
              <span className="sr-only sm:hidden">{t('nav.account')}</span>
              <span className="hidden text-right sm:block">
                <span className="block font-medium">{session.user.name ?? session.user.email}</span>
                <span className="block text-xs text-muted-foreground">{t(`dashboard.role.${session.user.role}`)}</span>
              </span>
            </Link>
            <form action={signOutAction.bind(null, isLocale(locale) ? locale : routing.defaultLocale)}>
              <Button type="submit" variant="ghost" size="sm">
                <LogOut aria-hidden />
                <span className="sr-only sm:not-sr-only">{t('common.signOut')}</span>
              </Button>
            </form>
          </div>
        </div>
        <div className="mx-auto flex max-w-6xl items-start justify-between gap-2 px-4 pb-2">
          <MainNav items={navItems} label={t('nav.mainNavigation')} />
          <div className="shrink-0 pt-1 sm:hidden">
            <Suspense>
              <LocaleSwitcher />
            </Suspense>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {/* Only after the session check above — guests never receive these strings. */}
        <NextIntlClientProvider messages={clientMessages}>{children}</NextIntlClientProvider>
      </main>
    </div>
  );
}

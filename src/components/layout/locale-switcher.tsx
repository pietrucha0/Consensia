'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';

import { Link, usePathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { cn } from '@/lib/utils';

/** Keeps the current path AND query (e.g. ?token= on reset links) when switching language. */
export function LocaleSwitcher() {
  const t = useTranslations();
  const current = useLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = Object.fromEntries(searchParams.entries());

  return (
    <nav aria-label={t('common.language')} className="flex items-center gap-1 text-xs font-medium">
      {routing.locales.map((locale) => (
        <Link
          key={locale}
          href={{ pathname, query }}
          locale={locale}
          hrefLang={locale}
          title={t(`locales.${locale}`)}
          aria-current={locale === current ? 'true' : undefined}
          className={cn(
            'rounded-md px-2 py-1 uppercase transition-colors',
            locale === current
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
          )}
        >
          {locale}
        </Link>
      ))}
    </nav>
  );
}

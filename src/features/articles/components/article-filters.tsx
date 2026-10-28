'use client';

import { Loader2, Search, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { usePathname, useRouter } from '@/i18n/navigation';

import { ARTICLE_SORTS, type ArticleSort } from '../schemas';

const SEARCH_DEBOUNCE_MS = 300;

const SORT_LABEL_KEYS = { newest: 'sortNewest', oldest: 'sortOldest' } as const satisfies Record<ArticleSort, string>;

/** Filters live in the URL (shareable, back-button friendly); the server renders results. */
export function ArticleFilters() {
  const t = useTranslations('articles');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const urlQuery = searchParams.get('q') ?? '';
  const [query, setQuery] = useState(urlQuery);
  /** Last `q` this component wrote to the URL — tells our own updates apart from back/forward. */
  const lastPushedQuery = useRef(urlQuery);

  const update = useCallback(
    (patch: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      params.delete('page'); // any filter change restarts at page 1
      const search = params.toString();
      startTransition(() => router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false }));
    },
    [pathname, router, searchParams],
  );

  // Debounced title search. Comparing trimmed values avoids re-navigating to the same URL.
  useEffect(() => {
    const next = query.trim();
    if (next === lastPushedQuery.current) return;
    const timer = setTimeout(() => {
      lastPushedQuery.current = next;
      update({ q: next });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, update]);

  // Back/forward (or "clear") changed `q` without us typing: mirror it into the input.
  // Our own pushes are skipped, so characters typed while a search is in flight survive.
  useEffect(() => {
    if (urlQuery === lastPushedQuery.current) return;
    lastPushedQuery.current = urlQuery;
    setQuery(urlQuery);
  }, [urlQuery]);

  const from = searchParams.get('from') ?? '';
  const to = searchParams.get('to') ?? '';
  const sort = searchParams.get('sort') === 'oldest' ? 'oldest' : 'newest';
  const hasFilters = Boolean(urlQuery || from || to || searchParams.get('sort'));

  return (
    <div role="search" className="grid gap-4 rounded-xl border bg-card p-4 shadow-sm md:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto] md:items-end">
      <div className="grid gap-2">
        <Label htmlFor="article-search">{t('searchLabel')}</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            id="article-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('searchPlaceholder')}
            maxLength={100}
            className="pl-9"
          />
          {pending && (
            <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden />
          )}
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="article-sort">{t('sortLabel')}</Label>
        <NativeSelect id="article-sort" value={sort} onChange={(e) => update({ sort: e.target.value === 'newest' ? '' : e.target.value })}>
          {ARTICLE_SORTS.map((value) => (
            <option key={value} value={value}>
              {t(SORT_LABEL_KEYS[value])}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="grid grid-cols-2 gap-4 md:contents">
        <div className="grid gap-2">
          <Label htmlFor="article-from">{t('from')}</Label>
          <Input id="article-from" type="date" value={from} max={to || undefined} onChange={(e) => update({ from: e.target.value })} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="article-to">{t('to')}</Label>
          <Input id="article-to" type="date" value={to} min={from || undefined} onChange={(e) => update({ to: e.target.value })} />
        </div>
      </div>

      <Button
        type="button"
        variant="ghost"
        disabled={!hasFilters}
        onClick={() => {
          lastPushedQuery.current = '';
          setQuery('');
          startTransition(() => router.replace(pathname, { scroll: false }));
        }}
      >
        <X aria-hidden />
        {t('clearFilters')}
      </Button>
    </div>
  );
}

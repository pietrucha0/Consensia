'use client';

import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

export type NavItem = {
  href: string;
  label: string;
  /** Extra path prefixes that mark this item active (e.g. "/articles" for the home feed). */
  alsoActiveOn?: string[];
};

function isActive(pathname: string, item: NavItem): boolean {
  const matches = (prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);
  if (item.href === '/' ? pathname === '/' : matches(item.href)) return true;
  return (item.alsoActiveOn ?? []).some(matches);
}

export function MainNav({ items, label }: { items: NavItem[]; label: string }) {
  const pathname = usePathname();

  return (
    // Wraps rather than scrolls: a clipped, scrollable row hides items with no affordance on phones.
    <nav aria-label={label} className="-mx-1 flex flex-wrap items-center gap-1">
      {items.map((item) => {
        const active = isActive(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors',
              active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

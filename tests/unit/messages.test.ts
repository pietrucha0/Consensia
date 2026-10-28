import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { routing } from '@/i18n/routing';

/**
 * Every language must have exactly the same keys, and each message must use the same
 * ICU placeholders — a missing `{title}` would render literally in one language only.
 */
type Tree = { [key: string]: string | Tree };

function load(locale: string): Tree {
  return JSON.parse(readFileSync(path.resolve(import.meta.dirname, `../../messages/${locale}.json`), 'utf8')) as Tree;
}

function flatten(tree: Tree, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out.set(full, value);
    else for (const [k, v] of flatten(value, full)) out.set(k, v);
  }
  return out;
}

/** Top-level argument names: "{count, plural, one {# x}}" → ["count"]; "{name}" → ["name"]. */
function placeholders(message: string): string[] {
  const names = new Set<string>();
  let depth = 0;
  for (let i = 0; i < message.length; i += 1) {
    const char = message[i];
    if (char === '{') {
      if (depth === 0) {
        const match = /^\{\s*([A-Za-z0-9_]+)/.exec(message.slice(i));
        if (match?.[1]) names.add(match[1]);
      }
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
    }
  }
  return [...names].sort();
}

const catalogs = Object.fromEntries(routing.locales.map((locale) => [locale, flatten(load(locale))]));
const reference = catalogs[routing.defaultLocale]!;

describe('message catalogs', () => {
  it.each(routing.locales)('%s has the same keys as English', (locale) => {
    expect([...catalogs[locale]!.keys()].sort()).toEqual([...reference.keys()].sort());
  });

  it.each(routing.locales)('%s uses the same placeholders as English', (locale) => {
    const mismatches: string[] = [];
    for (const [key, english] of reference) {
      const translated = catalogs[locale]!.get(key) ?? '';
      if (placeholders(translated).join() !== placeholders(english).join()) mismatches.push(key);
    }
    expect(mismatches).toEqual([]);
  });

  it('has no empty messages', () => {
    const empty = routing.locales.flatMap((locale) =>
      [...catalogs[locale]!].filter(([, value]) => value.trim() === '').map(([key]) => `${locale}:${key}`),
    );
    expect(empty).toEqual([]);
  });
});

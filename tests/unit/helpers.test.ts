import { describe, expect, it } from 'vitest';

import { slugify } from '@/features/articles/schemas';
import { tallyVotes } from '@/features/resolutions/tally';
import { pickTranslation } from '@/i18n/pick-translation';
import { safeCallbackUrl } from '@/lib/auth/callback-url';
import { detectImageType } from '@/lib/image-type';
import { escapeLikePattern } from '@/lib/like-pattern';
import {
  startOfDayInTimeZone,
  startOfNextDayInTimeZone,
  utcToZonedDateTimeInput,
  zonedDateTimeToUtc,
} from '@/lib/time-zone';

describe('escapeLikePattern', () => {
  it('escapes LIKE wildcards and the escape character', () => {
    expect(escapeLikePattern('100%')).toBe('100\\%');
    expect(escapeLikePattern('a_b')).toBe('a\\_b');
    expect(escapeLikePattern('c:\\dir')).toBe('c:\\\\dir');
  });
  it('leaves ordinary text alone', () => {
    expect(escapeLikePattern('Walne zgromadzenie')).toBe('Walne zgromadzenie');
  });
});

describe('time zone helpers (Europe/Warsaw)', () => {
  const zone = 'Europe/Warsaw';

  it('finds local midnight in summer (UTC+2) and winter (UTC+1)', () => {
    expect(startOfDayInTimeZone('2026-07-15', zone).toISOString()).toBe('2026-07-14T22:00:00.000Z');
    expect(startOfDayInTimeZone('2026-01-15', zone).toISOString()).toBe('2026-01-14T23:00:00.000Z');
  });

  it('gives the next local midnight as the exclusive end of a day', () => {
    expect(startOfNextDayInTimeZone('2026-12-31', zone).toISOString()).toBe('2026-12-31T23:00:00.000Z');
  });

  it('handles the DST change day (25 h long in autumn)', () => {
    const start = startOfDayInTimeZone('2026-10-25', zone);
    const end = startOfNextDayInTimeZone('2026-10-25', zone);
    expect((end.getTime() - start.getTime()) / 3_600_000).toBe(25);
  });

  it('round-trips a datetime-local value', () => {
    const utc = zonedDateTimeToUtc('2026-09-30T18:00', zone);
    expect(utc.toISOString()).toBe('2026-09-30T16:00:00.000Z');
    expect(utcToZonedDateTimeInput(utc, zone)).toBe('2026-09-30T18:00');
  });
});

describe('detectImageType (magic bytes, not the file name)', () => {
  const bytes = (...values: number[]) => new Uint8Array([...values, ...new Array(16).fill(0)]);

  it('recognises the allowed formats', () => {
    expect(detectImageType(bytes(0xff, 0xd8, 0xff))?.ext).toBe('jpg');
    expect(detectImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))?.ext).toBe('png');
    expect(detectImageType(bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61))?.ext).toBe('gif');
  });

  it('rejects SVG, HTML and PDF content', () => {
    const text = (s: string) => new TextEncoder().encode(s);
    expect(detectImageType(text('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(detectImageType(text('<!doctype html><script>alert(1)</script>'))).toBeNull();
    expect(detectImageType(text('%PDF-1.7'))).toBeNull();
  });
});

describe('safeCallbackUrl (open-redirect guard)', () => {
  it('keeps same-origin app paths with their query', () => {
    expect(safeCallbackUrl('/pl/resolutions/abc?x=1', 'pl')).toBe('/pl/resolutions/abc?x=1');
  });

  it.each([
    'https://evil.example/phish',
    '//evil.example',
    '/\\evil.example',
    'javascript:alert(1)',
    '/pl/auth/signin',
    '/auth/signup',
    '',
    undefined,
  ])('falls back to the locale home for %s', (raw) => {
    expect(safeCallbackUrl(raw, 'pl')).toBe('/pl');
  });
});

describe('pickTranslation', () => {
  const rows = [
    { locale: 'fr' as const, title: 'Bonjour' },
    { locale: 'en' as const, title: 'Hello' },
  ];
  it('prefers the reader locale, then English, then anything', () => {
    expect(pickTranslation(rows, 'fr')?.title).toBe('Bonjour');
    expect(pickTranslation(rows, 'pl')?.title).toBe('Hello');
    expect(pickTranslation([{ locale: 'es' as const, title: 'Hola' }], 'pl')?.title).toBe('Hola');
    expect(pickTranslation([], 'pl')).toBeUndefined();
  });
});

describe('slugify', () => {
  it('transliterates Polish, French and Spanish letters', () => {
    expect(slugify('Zażółć gęślą jaźń — 2026!')).toBe('zazolc-gesla-jazn-2026');
    expect(slugify('Élection du Conseil')).toBe('election-du-conseil');
    expect(slugify('Año nuevo')).toBe('ano-nuevo');
  });
});

describe('tallyVotes', () => {
  it('computes shares with one decimal in display order', () => {
    const result = tallyVotes({
      optionIds: ['for', 'against', 'abstain'],
      counts: new Map([
        ['for', 2],
        ['against', 1],
      ]),
      eligible: 10,
      eligibleIsFinal: true,
    });
    expect(result.totalVotes).toBe(3);
    expect(result.options).toEqual([
      { id: 'for', votes: 2, percentage: 66.7 },
      { id: 'against', votes: 1, percentage: 33.3 },
      { id: 'abstain', votes: 0, percentage: 0 },
    ]);
    expect(result.eligibleVoters).toBe(10);
  });

  it('never reports turnout above 100 %', () => {
    const result = tallyVotes({ optionIds: ['a'], counts: new Map([['a', 5]]), eligible: 3, eligibleIsFinal: false });
    expect(result.eligibleVoters).toBe(5);
  });

  it('shows 0 % everywhere before the first vote', () => {
    const result = tallyVotes({ optionIds: ['a', 'b'], counts: new Map(), eligible: 4, eligibleIsFinal: false });
    expect(result.options.map((o) => o.percentage)).toEqual([0, 0]);
  });
});

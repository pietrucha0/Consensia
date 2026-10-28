import { describe, expect, it } from 'vitest';

import { changeEmailSchema, changePasswordSchema, profileSchema } from '@/features/account/schemas';
import { isRichTextEmpty, parseRichText } from '@/features/articles/rich-text';
import { signUpSchema } from '@/features/auth/schemas';
import { emptyResolutionForm, resolutionFormSchema, type ResolutionFormValues } from '@/features/resolutions/schemas';
import { userListFiltersSchema } from '@/features/users/schemas';

const messages = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.success ? [] : (result.error?.issues.map((i) => i.message) ?? []);

describe('auth schemas', () => {
  it('normalises the email address', () => {
    const parsed = signUpSchema.parse({
      name: 'Anna Nowak',
      email: '  Anna.Nowak@Example.COM ',
      password: 'correct horse battery',
      confirmPassword: 'correct horse battery',
    });
    expect(parsed.email).toBe('anna.nowak@example.com');
  });

  it('enforces password length and confirmation', () => {
    const base = { name: 'Anna', email: 'a@example.com' };
    expect(messages(signUpSchema.safeParse({ ...base, password: 'short', confirmPassword: 'short' }))).toContain(
      'passwordTooShort',
    );
    expect(
      messages(signUpSchema.safeParse({ ...base, password: 'long enough password', confirmPassword: 'different one!' })),
    ).toContain('passwordsMismatch');
  });
});

describe('account schemas', () => {
  it('rejects a new password equal to the current one', () => {
    const same = 'a very good password';
    expect(
      messages(changePasswordSchema.safeParse({ currentPassword: same, newPassword: same, confirmPassword: same })),
    ).toContain('passwordUnchanged');
  });

  it('validates the profile and the new email', () => {
    expect(profileSchema.safeParse({ name: 'A', preferredLocale: 'pl', notifyNewResolutions: true }).success).toBe(false);
    expect(profileSchema.safeParse({ name: 'Anna', preferredLocale: 'de', notifyNewResolutions: true }).success).toBe(false);
    expect(changeEmailSchema.parse({ newEmail: 'New@Example.com', currentPassword: 'x' }).newEmail).toBe('new@example.com');
  });
});

describe('rich text allow-list', () => {
  const doc = (content: unknown) => ({ type: 'doc', content });

  it('accepts the supported nodes', () => {
    const parsed = parseRichText(
      doc([
        { type: 'paragraph', content: [{ type: 'text', text: 'Hello', marks: [{ type: 'bold' }] }] },
        { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }] },
      ]),
    );
    expect(parsed).not.toBeNull();
  });

  it('rejects unknown nodes and dangerous links', () => {
    expect(parseRichText(doc([{ type: 'iframe', attrs: { src: 'https://evil.example' } }]))).toBeNull();
    expect(
      parseRichText(
        doc([
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }],
          },
        ]),
      ),
    ).toBeNull();
  });

  it('treats whitespace-only documents as empty', () => {
    expect(isRichTextEmpty(parseRichText(doc([{ type: 'paragraph', content: [{ type: 'text', text: '   ' }] }])))).toBe(
      true,
    );
    expect(isRichTextEmpty(null)).toBe(true);
  });
});

describe('resolution form schema', () => {
  const blankOption = { en: '', pl: '', es: '', fr: '' };
  const valid = (): ResolutionFormValues => {
    const form = emptyResolutionForm([
      { ...blankOption, pl: 'Za' },
      { ...blankOption, pl: 'Przeciw' },
    ]);
    form.translations.pl = { title: 'W sprawie budżetu', description: 'Uzasadnienie' };
    return form;
  };

  it('accepts a resolution written in one language', () => {
    expect(resolutionFormSchema.safeParse(valid()).success).toBe(true);
  });

  it('requires at least one language', () => {
    const form = valid();
    form.translations.pl = { title: '', description: '' };
    expect(messages(resolutionFormSchema.safeParse(form))).toContain('translationRequired');
  });

  it('requires every option in every language the resolution uses', () => {
    const form = valid();
    form.translations.en = { title: 'On the budget', description: 'Reasons' };
    expect(messages(resolutionFormSchema.safeParse(form))).toContain('optionLabelRequired');
  });

  it('allows between 2 and 10 options', () => {
    const one = valid();
    one.options = one.options.slice(0, 1);
    expect(messages(resolutionFormSchema.safeParse(one))).toContain('optionsTooFew');
  });
});

describe('member list filters', () => {
  it('falls back to defaults for malformed query values', () => {
    expect(userListFiltersSchema.parse({ q: 'anna', status: 'hacker', role: 'ROOT', page: '-3' })).toEqual({
      q: 'anna',
      status: 'all',
      role: undefined,
      page: 1,
    });
  });
});

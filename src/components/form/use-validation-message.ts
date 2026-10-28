'use client';

import { useMessages, useTranslations, type Messages } from 'next-intl';

import { NAME_MAX_LENGTH, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@/features/auth/schemas';

type ValidationKey = keyof Messages['validation'];

/** Checked against the loaded catalog, so a new message key needs no list update here. */
function isValidationKey(catalog: Messages['validation'], value: string): value is ValidationKey {
  return Object.hasOwn(catalog, value);
}

/** Turns a Zod error message (a `validation.*` key) into translated text. */
export function useValidationMessage(): (message: string | undefined) => string | undefined {
  const t = useTranslations('validation');
  const catalog = useMessages().validation;

  return (message) => {
    if (!message) return undefined;
    const key = isValidationKey(catalog, message) ? message : 'invalid';
    return t(key, {
      min: PASSWORD_MIN_LENGTH,
      max: key === 'nameTooLong' ? NAME_MAX_LENGTH : PASSWORD_MAX_LENGTH,
    });
  };
}

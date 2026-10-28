import { z } from 'zod';

import { currentPasswordField, emailField, NAME_MAX_LENGTH, newPasswordField } from '@/features/auth/schemas';
import { routing } from '@/i18n/routing';

/** Shared by the account forms and their Server Actions. Messages are `validation.*` keys. */

export const profileSchema = z.object({
  name: z.string().trim().min(2, { error: 'nameTooShort' }).max(NAME_MAX_LENGTH, { error: 'nameTooLong' }),
  preferredLocale: z.enum(routing.locales),
  notifyNewResolutions: z.boolean(),
});

export const changePasswordSchema = z
  .object({
    currentPassword: currentPasswordField,
    newPassword: newPasswordField,
    confirmPassword: z.string().min(1, { error: 'required' }),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    error: 'passwordsMismatch',
    path: ['confirmPassword'],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    error: 'passwordUnchanged',
    path: ['newPassword'],
  });

export const changeEmailSchema = z.object({
  newEmail: emailField,
  currentPassword: currentPasswordField,
});

export type ProfileValues = z.input<typeof profileSchema>;
export type ChangePasswordValues = z.input<typeof changePasswordSchema>;
export type ChangeEmailValues = z.input<typeof changeEmailSchema>;

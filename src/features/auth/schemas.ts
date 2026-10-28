import { z } from 'zod';

import { routing } from '@/i18n/routing';

/**
 * Shared by the client forms (react-hook-form resolver) and the Server Actions.
 * Error messages are keys of the `validation` namespace in messages/*.json.
 */

export const PASSWORD_MIN_LENGTH = 12;
/** Upper bound keeps argon2 hashing cheap enough to not be a DoS vector. */
export const PASSWORD_MAX_LENGTH = 128;
export const NAME_MAX_LENGTH = 120;

export const emailField = z
  .string()
  .trim()
  .min(1, { error: 'required' })
  .max(254, { error: 'invalidEmail' })
  .pipe(z.email({ error: 'invalidEmail' }))
  .transform((email) => email.toLowerCase());

export const newPasswordField = z
  .string()
  .min(PASSWORD_MIN_LENGTH, { error: 'passwordTooShort' })
  .max(PASSWORD_MAX_LENGTH, { error: 'passwordTooLong' });

/** Sign-in never reveals the password policy — just "required" and a length cap. */
export const currentPasswordField = z
  .string()
  .min(1, { error: 'required' })
  .max(PASSWORD_MAX_LENGTH, { error: 'passwordTooLong' });

const tokenField = z.string().min(20).max(200);

const localeField = z.enum(routing.locales);

export const signInSchema = z.object({
  email: emailField,
  password: currentPasswordField,
});

export const signUpSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, { error: 'nameTooShort' })
      .max(NAME_MAX_LENGTH, { error: 'nameTooLong' }),
    email: emailField,
    password: newPasswordField,
    confirmPassword: z.string().min(1, { error: 'required' }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: 'passwordsMismatch',
    path: ['confirmPassword'],
  });

export const forgotPasswordSchema = z.object({
  email: emailField,
});

export const resetPasswordSchema = z
  .object({
    password: newPasswordField,
    confirmPassword: z.string().min(1, { error: 'required' }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: 'passwordsMismatch',
    path: ['confirmPassword'],
  });

// ── Server Action inputs (form values + context the form adds) ────────────────

export const signInActionSchema = signInSchema.extend({
  locale: localeField,
  callbackUrl: z.string().max(2048).optional(),
});

export const signUpActionSchema = signUpSchema.and(z.object({ locale: localeField }));

export const resendVerificationActionSchema = signInSchema.extend({ locale: localeField });

export const verifyEmailActionSchema = z.object({ token: tokenField, locale: localeField });

export const forgotPasswordActionSchema = forgotPasswordSchema.extend({ locale: localeField });

export const resetPasswordActionSchema = resetPasswordSchema.and(
  z.object({ token: tokenField, locale: localeField }),
);

export type SignInValues = z.input<typeof signInSchema>;
export type SignUpValues = z.input<typeof signUpSchema>;
export type ForgotPasswordValues = z.input<typeof forgotPasswordSchema>;
export type ResetPasswordValues = z.input<typeof resetPasswordSchema>;

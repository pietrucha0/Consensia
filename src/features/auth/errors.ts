/** Every code maps to a key in the `auth.errors` namespace of messages/*.json. */
export type AuthErrorCode =
  | 'invalid_credentials'
  | 'email_not_verified'
  | 'account_locked'
  | 'account_disabled'
  | 'rate_limited'
  | 'invalid_token'
  | 'validation'
  | 'generic';

export type SignInErrorCode = Extract<
  AuthErrorCode,
  'invalid_credentials' | 'email_not_verified' | 'account_locked' | 'account_disabled' | 'rate_limited'
>;

export type ActionResult = { ok: true } | { ok: false; error: AuthErrorCode };

import 'server-only';

import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.url(),
  AUTH_SECRET: z.string().min(32, 'AUTH_SECRET must be at least 32 characters'),
  APP_URL: z.url().transform((url) => url.replace(/\/+$/, '')),
  RESEND_API_KEY: z.string().optional().transform((v) => (v ? v : undefined)),
  EMAIL_FROM: z.string().min(3),
  /**
   * "resend" sends real email; "console" prints it to the server log. Defaults to "resend"
   * when RESEND_API_KEY is set. Production refuses to guess: without a key it must be set
   * to "console" explicitly (test deployments only).
   */
  EMAIL_TRANSPORT: z.preprocess((v) => (v === '' ? undefined : v), z.enum(['resend', 'console']).optional()),
  /** IANA zone used to display dates and to interpret date filters (a "day" starts at local midnight). */
  APP_TIME_ZONE: z
    .string()
    .default('Europe/Warsaw')
    .refine((zone) => {
      try {
        new Intl.DateTimeFormat('en', { timeZone: zone });
        return true;
      } catch {
        return false;
      }
    }, 'APP_TIME_ZONE must be a valid IANA time zone, e.g. Europe/Warsaw'),
  /** Where uploaded images are stored (outside /public, served only to signed-in users). */
  UPLOAD_DIR: z.string().default('storage/uploads'),
  /** Shared secret for /api/cron/maintenance. Unset = endpoint disabled. */
  CRON_SECRET: z
    .string()
    .optional()
    .transform((v) => (v ? v : undefined))
    .pipe(z.string().min(32, 'CRON_SECRET must be at least 32 characters').optional()),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast at boot/build instead of on the first request that needs a value.
  console.error('❌ Invalid environment variables:', z.flattenError(parsed.error).fieldErrors);
  throw new Error('Invalid environment variables — see .env.example');
}

const emailTransport = parsed.data.EMAIL_TRANSPORT ?? (parsed.data.RESEND_API_KEY ? 'resend' : 'console');
if (emailTransport === 'resend' && !parsed.data.RESEND_API_KEY) {
  throw new Error('EMAIL_TRANSPORT=resend requires RESEND_API_KEY');
}
if (parsed.data.NODE_ENV === 'production' && emailTransport === 'console' && !parsed.data.EMAIL_TRANSPORT) {
  throw new Error('RESEND_API_KEY is required in production (or set EMAIL_TRANSPORT=console on a test deployment)');
}

export const env = { ...parsed.data, EMAIL_TRANSPORT: emailTransport };

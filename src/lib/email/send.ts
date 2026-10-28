import 'server-only';

import type { ReactElement } from 'react';
import { Resend } from 'resend';

import { env } from '@/env';

export type Email = {
  to: string;
  subject: string;
  react: ReactElement;
  /** Plain-text alternative; also what gets printed in development. */
  text: string;
};

const resend = env.EMAIL_TRANSPORT === 'resend' && env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export async function sendEmail(email: Email): Promise<void> {
  if (!resend) {
    // EMAIL_TRANSPORT=console (the default without a Resend key): print the message and its links.
    console.info(`\n📧 [email:console] to=${email.to}\n   subject: ${email.subject}\n${email.text}\n`);
    return;
  }

  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: email.to,
    subject: email.subject,
    react: email.react,
    text: email.text,
  });
  if (error) throw new Error(`Resend failed (${error.name}): ${error.message}`);
}

/** Resend accepts at most 100 messages per batch call. */
const BATCH_SIZE = 100;

/** Many messages at once (e.g. announcing a resolution). Stops at the first failed chunk. */
export async function sendEmailBatch(emails: readonly Email[]): Promise<void> {
  if (!resend) {
    for (const email of emails) await sendEmail(email);
    return;
  }

  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const chunk = emails.slice(i, i + BATCH_SIZE).map((email) => ({
      from: env.EMAIL_FROM,
      to: email.to,
      subject: email.subject,
      react: email.react,
      text: email.text,
    }));
    const { error } = await resend.batch.send(chunk);
    if (error) throw new Error(`Resend batch failed (${error.name}): ${error.message}`);
  }
}

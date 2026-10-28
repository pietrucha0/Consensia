// No 'server-only' marker: prisma/seed.ts reuses this module outside Next.js.
// It can never reach a client bundle anyway (native module, server-external).
import { hash, verify, type Algorithm, type Options } from '@node-rs/argon2';

// `Algorithm` is an ambient const enum (not readable under isolatedModules); 2 = Argon2id.
const ARGON2ID = 2 as Algorithm;

// OWASP Password Storage Cheat Sheet: argon2id, m = 19 MiB, t = 2, p = 1.
const OPTIONS: Options = {
  algorithm: ARGON2ID,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | undefined;

/**
 * Burns the same CPU time as a real verification. Called when the email is unknown,
 * so response timing does not reveal whether an account exists.
 */
export async function verifyAgainstDummy(password: string): Promise<false> {
  dummyHash ??= hashPassword('consensia-timing-equalizer');
  await verifyPassword(await dummyHash, password);
  return false;
}

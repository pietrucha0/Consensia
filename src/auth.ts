import 'server-only';

import { randomBytes } from 'node:crypto';

import { PrismaAdapter } from '@auth/prisma-adapter';
import NextAuth, { CredentialsSignin } from 'next-auth';
import { encode as encodeJwt } from 'next-auth/jwt';
import Credentials from 'next-auth/providers/credentials';

import { authenticate } from '@/features/auth/credentials';
import { SIGN_IN_PATH } from '@/lib/auth/routes';
import { prisma } from '@/lib/prisma';

const SESSION_MAX_AGE_S = 7 * 24 * 60 * 60; // 7 days
const SESSION_UPDATE_AGE_S = 24 * 60 * 60; // extend expiry at most once a day

const adapter = PrismaAdapter(prisma);

/**
 * Database sessions with the Credentials provider.
 *
 * Auth.js always issues credential logins through `jwt.encode`, and refuses
 * `session.strategy: "database"` when it is set explicitly for a credentials-only setup.
 * So: the strategy is left unset (with an adapter it defaults to "database"), and
 * `jwt.encode` is overridden to create a `Session` row and return its opaque token
 * as the cookie value. Everything after that — reading, extending, signing out —
 * is the stock database-session path, and sessions are revocable by deleting rows.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter,
  session: { maxAge: SESSION_MAX_AGE_S, updateAge: SESSION_UPDATE_AGE_S },
  pages: { signIn: SIGN_IN_PATH, error: SIGN_IN_PATH },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: (credentials) => authenticate(credentials),
    }),
  ],
  callbacks: {
    jwt({ token, account }) {
      if (account?.provider === 'credentials') token.credentials = true;
      return token;
    },
    session({ session, user }) {
      session.user.id = user.id;
      session.user.role = user.role;
      return session;
    },
  },
  jwt: {
    async encode(params) {
      if (params.token?.credentials !== true) return encodeJwt(params);

      const userId = params.token.sub;
      if (!userId) throw new Error('Credentials sign-in produced a token without a user id');

      const sessionToken = randomBytes(32).toString('base64url');
      await prisma.session.create({
        data: { sessionToken, userId, expires: new Date(Date.now() + SESSION_MAX_AGE_S * 1000) },
      });
      return sessionToken;
    },
  },
  logger: {
    // Wrong passwords are expected traffic, not server errors.
    error(error) {
      if (error instanceof CredentialsSignin) return;
      console.error('[auth]', error);
    },
  },
});

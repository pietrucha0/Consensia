import type { DefaultSession } from 'next-auth';

import type { Role } from '@/generated/prisma/enums';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession['user'];
  }
}

declare module '@auth/core/adapters' {
  interface AdapterUser {
    role: Role;
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    /** Marks a credentials sign-in so `jwt.encode` issues a database session instead. */
    credentials?: boolean;
  }
}

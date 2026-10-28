import { z } from 'zod';

import { Role } from '@/generated/prisma/enums';

export const ROLES = [Role.USER, Role.MODERATOR, Role.ADMIN] as const;

export const USER_STATUS_FILTERS = ['all', 'active', 'unverified', 'disabled'] as const;
export type UserStatusFilter = (typeof USER_STATUS_FILTERS)[number];

export const USERS_PAGE_SIZE = 25;

const userIdField = z.string().min(1).max(64);

export const changeRoleInputSchema = z.object({ userId: userIdField, role: z.enum(ROLES) });
export const setDisabledInputSchema = z.object({ userId: userIdField, disabled: z.boolean() });

/** URL filters (?q=&status=&role=&page=) — anything malformed falls back to the default. */
export const userListFiltersSchema = z.object({
  q: z.string().trim().max(100).catch(''),
  status: z.enum(USER_STATUS_FILTERS).catch('all'),
  role: z.enum(ROLES).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});
export type UserListFilters = z.output<typeof userListFiltersSchema>;

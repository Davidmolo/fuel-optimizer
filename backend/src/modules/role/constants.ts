export const ADMIN_ROLE_NAME = "admin";
export const USER_ROLE_NAME = "user";

export const ACCOUNT_ROLES = [ADMIN_ROLE_NAME, USER_ROLE_NAME] as const;

export type AccountRole = (typeof ACCOUNT_ROLES)[number];

export function isAccountRole(value: string): value is AccountRole {
  return (ACCOUNT_ROLES as readonly string[]).includes(value);
}

export function isAdminRole(role: string | null | undefined) {
  return role === ADMIN_ROLE_NAME;
}

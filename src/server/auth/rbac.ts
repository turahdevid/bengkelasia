import { type Session } from "next-auth";

export function hasRole(session: Session | null | undefined, roleName: string) {
  const name = session?.user?.role?.name;
  return typeof name === "string" && name === roleName;
}

export function hasPermission(
  session: Session | null | undefined,
  permissionName: string,
) {
  const perms = session?.user?.permissions;
  return Array.isArray(perms) && perms.includes(permissionName);
}

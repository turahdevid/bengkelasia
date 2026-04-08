import { PrismaClient } from "../generated/prisma";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const permissions = [
    "create_service",
    "update_service",
    "delete_service",
    "view_dashboard",
    "manage_users",
  ] as const;

  await db.permission.createMany({
    data: permissions.map((name) => ({ name })),
    skipDuplicates: true,
  });

  const permissionRows: Array<{ id: string; name: string }> =
    await db.permission.findMany({
      where: { name: { in: [...permissions] } },
      select: { id: true, name: true },
    });

  const permissionIdByName = new Map<string, string>(
    permissionRows.map((p) => [p.name, p.id]),
  );

  const roles = [
    { name: "admin", description: "System administrator" },
    { name: "kasir", description: "Cashier / front desk" },
    { name: "mekanik", description: "Technician" },
    { name: "owner", description: "Workshop owner" },
  ] as const;

  await db.role.createMany({
    data: roles.map((r) => ({ name: r.name, description: r.description })),
    skipDuplicates: true,
  });

  const roleRows: Array<{ id: string; name: string }> = await db.role.findMany({
    where: { name: { in: roles.map((r) => r.name) } },
    select: { id: true, name: true },
  });

  const roleIdByName = new Map<string, string>(roleRows.map((r) => [r.name, r.id]));

  const adminRoleId = roleIdByName.get("admin");
  const kasirRoleId = roleIdByName.get("kasir");
  const mekanikRoleId = roleIdByName.get("mekanik");

  if (!adminRoleId || !kasirRoleId || !mekanikRoleId) {
    throw new Error("Seed failed: missing role IDs");
  }

  const allPermissionIds: string[] = permissionRows.map((p) => p.id);
  const updateServiceId = permissionIdByName.get("update_service");
  const createServiceId = permissionIdByName.get("create_service");

  if (!updateServiceId || !createServiceId) {
    throw new Error("Seed failed: missing permission IDs");
  }

  await db.rolePermission.createMany({
    data: allPermissionIds.map((permissionId) => ({
      roleId: adminRoleId,
      permissionId,
    })),
    skipDuplicates: true,
  });

  await db.rolePermission.createMany({
    data: [{ roleId: mekanikRoleId, permissionId: updateServiceId }],
    skipDuplicates: true,
  });

  await db.rolePermission.createMany({
    data: [{ roleId: kasirRoleId, permissionId: createServiceId }],
    skipDuplicates: true,
  });

  const defaultPassword = "Password123!";
  const passwordHash = await bcrypt.hash(defaultPassword, 12);

  await db.user.upsert({
    where: { email: "admin@bengkelasia.local" },
    update: {
      name: "Admin",
      password: passwordHash,
      roleId: adminRoleId,
    },
    create: {
      email: "admin@bengkelasia.local",
      name: "Admin",
      password: passwordHash,
      roleId: adminRoleId,
    },
  });

  await db.user.upsert({
    where: { email: "kasir@bengkelasia.local" },
    update: {
      name: "Kasir",
      password: passwordHash,
      roleId: kasirRoleId,
    },
    create: {
      email: "kasir@bengkelasia.local",
      name: "Kasir",
      password: passwordHash,
      roleId: kasirRoleId,
    },
  });

  await db.user.upsert({
    where: { email: "mekanik@bengkelasia.local" },
    update: {
      name: "Mekanik",
      password: passwordHash,
      roleId: mekanikRoleId,
    },
    create: {
      email: "mekanik@bengkelasia.local",
      name: "Mekanik",
      password: passwordHash,
      roleId: mekanikRoleId,
    },
  });

  const ownerRoleId = roleIdByName.get("owner");
  if (!ownerRoleId) {
    throw new Error("Seed failed: missing owner role ID");
  }

  await db.user.upsert({
    where: { email: "owner@bengkelasia.local" },
    update: {
      name: "Owner",
      password: passwordHash,
      roleId: ownerRoleId,
    },
    create: {
      email: "owner@bengkelasia.local",
      name: "Owner",
      password: passwordHash,
      roleId: ownerRoleId,
    },
  });
}

main()
  .then(async () => {
    await db.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import { Prisma } from "../../../../generated/prisma";

const roleNameSchema = z
  .string()
  .trim()
  .min(2, "Nama role minimal 2 karakter")
  .max(50, "Nama role maksimal 50 karakter")
  .regex(/^[a-z0-9_\-\s]+$/i, "Nama role hanya boleh huruf/angka/spasi/_/-");

const permissionNameSchema = z
  .string()
  .trim()
  .min(2, "Nama permission minimal 2 karakter")
  .max(80, "Nama permission maksimal 80 karakter")
  .regex(/^[a-z0-9_\-\.]+$/i, "Gunakan format seperti: create_service, read.user, dll");

export const rbacRouter = createTRPCRouter({
  listRoles: adminProcedure.query(async ({ ctx }) => {
    const roles = await ctx.db.role.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        _count: { select: { users: true, rolePermissions: true } },
      },
    });

    return roles;
  }),

  createRole: adminProcedure
    .input(z.object({ name: roleNameSchema }))
    .mutation(async ({ ctx, input }) => {
      try {
        const role = await ctx.db.role.create({
          data: { name: input.name },
          select: { id: true, name: true },
        });

        return role;
      } catch (err: unknown) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Nama role sudah digunakan",
          });
        }
        throw err;
      }
    }),

  updateRole: adminProcedure
    .input(z.object({ id: z.string().min(1), name: roleNameSchema }))
    .mutation(async ({ ctx, input }) => {
      const current = await ctx.db.role.findUnique({
        where: { id: input.id },
        select: { id: true, name: true },
      });

      if (!current) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Role tidak ditemukan" });
      }

      if (current.name === "admin" && input.name !== "admin") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Role admin tidak boleh diubah namanya",
        });
      }

      try {
        const role = await ctx.db.role.update({
          where: { id: input.id },
          data: { name: input.name },
          select: { id: true, name: true },
        });

        return role;
      } catch (err: unknown) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Nama role sudah digunakan",
          });
        }
        throw err;
      }
    }),

  deleteRole: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const role = await ctx.db.role.findUnique({
        where: { id: input.id },
        select: { id: true, name: true, _count: { select: { users: true } } },
      });

      if (!role) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Role tidak ditemukan" });
      }

      if (role.name === "admin") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Role admin tidak boleh dihapus",
        });
      }

      if (role._count.users > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Role ini masih dipakai oleh user. Pindahkan user dulu.",
        });
      }

      await ctx.db.rolePermission.deleteMany({ where: { roleId: input.id } });
      await ctx.db.role.delete({ where: { id: input.id } });

      return { ok: true };
    }),

  listPermissions: adminProcedure.query(async ({ ctx }) => {
    const permissions = await ctx.db.permission.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });

    return permissions;
  }),

  createPermission: adminProcedure
    .input(z.object({ name: permissionNameSchema }))
    .mutation(async ({ ctx, input }) => {
      try {
        const permission = await ctx.db.permission.create({
          data: { name: input.name },
          select: { id: true, name: true },
        });

        return permission;
      } catch (err: unknown) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Nama permission sudah digunakan",
          });
        }
        throw err;
      }
    }),

  deletePermission: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const perm = await ctx.db.permission.findUnique({
        where: { id: input.id },
        select: { id: true },
      });

      if (!perm) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Permission tidak ditemukan",
        });
      }

      await ctx.db.rolePermission.deleteMany({ where: { permissionId: input.id } });
      await ctx.db.permission.delete({ where: { id: input.id } });

      return { ok: true };
    }),

  getRolePermissions: adminProcedure
    .input(z.object({ roleId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const role = await ctx.db.role.findUnique({
        where: { id: input.roleId },
        select: {
          id: true,
          name: true,
          rolePermissions: { select: { permissionId: true } },
        },
      });

      if (!role) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Role tidak ditemukan" });
      }

      return {
        role: { id: role.id, name: role.name },
        permissionIds: role.rolePermissions.map((rp) => rp.permissionId),
      };
    }),

  setRolePermissions: adminProcedure
    .input(
      z.object({
        roleId: z.string().min(1),
        permissionIds: z.array(z.string().min(1)).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const role = await ctx.db.role.findUnique({
        where: { id: input.roleId },
        select: { id: true, name: true },
      });

      if (!role) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Role tidak ditemukan" });
      }

      await ctx.db.$transaction([
        ctx.db.rolePermission.deleteMany({ where: { roleId: input.roleId } }),
        ...(input.permissionIds.length
          ? [
              ctx.db.rolePermission.createMany({
                data: input.permissionIds.map((permissionId) => ({
                  roleId: input.roleId,
                  permissionId,
                })),
                skipDuplicates: true,
              }),
            ]
          : []),
      ]);

      return { ok: true };
    }),
});

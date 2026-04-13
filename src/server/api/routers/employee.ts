import { TRPCError } from "@trpc/server";
import { z } from "zod";
import bcrypt from "bcryptjs";

import { Prisma } from "../../../../generated/prisma";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.union([z.literal(10), z.literal(20), z.literal(50)]).default(10),
  query: z.string().trim().max(120).optional(),
});

const userIdSchema = z.string().min(1);
const employeeIdSchema = z.string().min(1);

const positionSchema = z
  .string()
  .trim()
  .min(2, "Posisi minimal 2 karakter")
  .max(60, "Posisi maksimal 60 karakter");

const optionalStringSchema = z.string().trim().min(1).max(500).optional();

const joinDateSchema = z
  .preprocess((val) => {
    if (val === null || val === undefined) return undefined;
    if (typeof val === "string") {
      const trimmed = val.trim();
      if (!trimmed) return undefined;
      return new Date(trimmed);
    }
    if (val instanceof Date) return val;
    return undefined;
  }, z.date().optional())
  .optional();

const userNameSchema = z.string().trim().min(2, "Nama minimal 2 karakter").max(120);
const emailSchema = z.string().trim().email("Email tidak valid").max(190);
const passwordSchema = z.string().min(8, "Password minimal 8 karakter").max(190);
const roleIdSchema = z.string().min(1);

export const employeeRouter = createTRPCRouter({
  listRoles: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.role.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
  }),

  list: protectedProcedure.input(paginationSchema).query(async ({ ctx, input }) => {
    const q = input.query?.trim();

    const where = q
      ? {
          OR: [
            { position: { contains: q } },
            { user: { name: { contains: q } } },
            { user: { email: { contains: q } } },
          ],
        }
      : undefined;

    const skip = (input.page - 1) * input.limit;

    const [total, items] = await ctx.db.$transaction([
      ctx.db.employee.count({ where }),
      ctx.db.employee.findMany({
        where,
        orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
        skip,
        take: input.limit,
        select: {
          id: true,
          position: true,
          phone: true,
          isActive: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
    ]);

    return {
      total,
      page: input.page,
      limit: input.limit,
      items,
    };
  }),

  getById: protectedProcedure
    .input(z.object({ id: employeeIdSchema }))
    .query(async ({ ctx, input }) => {
      const employee = await ctx.db.employee.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          position: true,
          phone: true,
          address: true,
          joinDate: true,
          isActive: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      if (!employee) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Pegawai tidak ditemukan" });
      }

      return employee;
    }),

  listAvailableUsers: protectedProcedure
    .input(z.object({ query: z.string().trim().max(120).optional() }).optional())
    .query(async ({ ctx, input }) => {
      const q = input?.query?.trim();

      return ctx.db.user.findMany({
        where: {
          employee: { is: null },
          ...(q
            ? {
                OR: [{ name: { contains: q } }, { email: { contains: q } }],
              }
            : {}),
        },
        orderBy: [{ name: "asc" }, { email: "asc" }],
        take: 50,
        select: { id: true, name: true, email: true },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        userId: userIdSchema,
        position: positionSchema,
        phone: optionalStringSchema,
        address: optionalStringSchema,
        joinDate: joinDateSchema,
        isActive: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: input.userId },
        select: { id: true },
      });

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User tidak ditemukan" });
      }

      try {
        const created = await ctx.db.employee.create({
          data: {
            userId: input.userId,
            position: input.position,
            phone: input.phone,
            address: input.address,
            joinDate: input.joinDate,
            isActive: input.isActive ?? true,
          },
          select: { id: true },
        });

        return { id: created.id };
      } catch (err: unknown) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          throw new TRPCError({
            code: "CONFLICT",
            message: "User ini sudah punya data pegawai",
          });
        }

        throw err;
      }
    }),

  createWithUser: protectedProcedure
    .input(
      z.object({
        user: z.object({
          name: userNameSchema,
          email: emailSchema,
          password: passwordSchema,
          roleId: roleIdSchema,
        }),
        employee: z.object({
          position: positionSchema,
          phone: optionalStringSchema,
          address: optionalStringSchema,
          joinDate: joinDateSchema,
          isActive: z.boolean().optional(),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const passwordHash = await bcrypt.hash(input.user.password, 12);

      try {
        const created = await ctx.db.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: {
              name: input.user.name,
              email: input.user.email,
              password: passwordHash,
              roleId: input.user.roleId,
            },
            select: { id: true },
          });

          const employee = await tx.employee.create({
            data: {
              userId: user.id,
              position: input.employee.position,
              phone: input.employee.phone,
              address: input.employee.address,
              joinDate: input.employee.joinDate,
              isActive: input.employee.isActive ?? true,
            },
            select: { id: true },
          });

          return { employeeId: employee.id };
        });

        return { id: created.employeeId };
      } catch (err: unknown) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Email sudah digunakan atau user sudah memiliki data pegawai",
          });
        }

        throw err;
      }
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: employeeIdSchema,
        position: positionSchema,
        phone: optionalStringSchema,
        address: optionalStringSchema,
        joinDate: joinDateSchema,
        isActive: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const employee = await ctx.db.employee.findUnique({
        where: { id: input.id },
        select: { id: true },
      });

      if (!employee) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Pegawai tidak ditemukan" });
      }

      await ctx.db.employee.update({
        where: { id: input.id },
        data: {
          position: input.position,
          phone: input.phone,
          address: input.address,
          joinDate: input.joinDate,
          isActive: input.isActive,
        },
        select: { id: true },
      });

      return { ok: true };
    }),
});

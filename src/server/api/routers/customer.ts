import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { Prisma } from "../../../../generated/prisma";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

const customerIdSchema = z.string().min(1);

const customerNameSchema = z
  .string()
  .trim()
  .min(2, "Nama minimal 2 karakter")
  .max(120, "Nama maksimal 120 karakter");

const phoneSchema = z
  .string()
  .trim()
  .min(6, "Nomor telepon tidak valid")
  .max(30, "Nomor telepon terlalu panjang");

const optionalStringSchema = z.string().trim().min(1).max(500).optional();

const birthDateSchema = z
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

const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.union([z.literal(10), z.literal(20), z.literal(50)]).default(10),
  query: z.string().trim().max(120).optional(),
});

const listAllSchema = z.object({
  query: z.string().trim().max(120).optional(),
});

const plateNumberSchema = z
  .string()
  .trim()
  .min(3, "Plat nomor wajib diisi")
  .max(16, "Plat nomor terlalu panjang")
  .transform((v) => v.toUpperCase().replace(/\s+/g, " "));

const vehicleBrandSchema = z
  .string()
  .trim()
  .min(1, "Brand wajib diisi")
  .max(60, "Brand terlalu panjang");

const vehicleModelSchema = z
  .string()
  .trim()
  .min(1, "Model wajib diisi")
  .max(60, "Model terlalu panjang");

const vehicleOptionalStringSchema = z.string().trim().min(1).max(120).optional();

export const customerRouter = createTRPCRouter({
  list: protectedProcedure.input(paginationSchema).query(async ({ ctx, input }) => {
    const q = input.query?.trim();

    const where = q
      ? {
          OR: [
            { name: { contains: q } },
            { phone: { contains: q } },
          ],
        }
      : undefined;

    const skip = (input.page - 1) * input.limit;

    const [total, items] = await ctx.db.$transaction([
      ctx.db.customer.count({ where }),
      ctx.db.customer.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: input.limit,
        select: {
          id: true,
          name: true,
          phone: true,
          createdAt: true,
          _count: { select: { vehicles: true } },
        },
      }),
    ]);

    return {
      total,
      page: input.page,
      limit: input.limit,
      items: items.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        createdAt: c.createdAt,
        totalVehicles: c._count.vehicles,
      })),
    };
  }),

  listAll: protectedProcedure.input(listAllSchema).query(async ({ ctx, input }) => {
    const q = input.query?.trim();

    const where = q
      ? {
          OR: [{ name: { contains: q } }, { phone: { contains: q } }],
        }
      : undefined;

    const items = await ctx.db.customer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        phone: true,
      },
    });

    return items;
  }),

  getById: protectedProcedure
    .input(z.object({ id: customerIdSchema }))
    .query(async ({ ctx, input }) => {
      const customer = await ctx.db.customer.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          name: true,
          phone: true,
          address: true,
          birthDate: true,
          note: true,
          createdAt: true,
          updatedAt: true,
          vehicles: {
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              plateNumber: true,
              brand: true,
              model: true,
              year: true,
              color: true,
              engineNumber: true,
              chassisNumber: true,
              currentOdometer: true,
              note: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      });

      if (!customer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Customer tidak ditemukan" });
      }

      return customer;
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: customerNameSchema,
        phone: phoneSchema,
        address: optionalStringSchema,
        birthDate: birthDateSchema,
        note: optionalStringSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const customer = await ctx.db.customer.create({
        data: {
          name: input.name,
          phone: input.phone,
          address: input.address,
          birthDate: input.birthDate ?? null,
          note: input.note,
        },
        select: { id: true },
      });

      return customer;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: customerIdSchema,
        name: customerNameSchema,
        phone: phoneSchema,
        address: optionalStringSchema,
        birthDate: birthDateSchema,
        note: optionalStringSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.customer.findUnique({
        where: { id: input.id },
        select: { id: true },
      });

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Customer tidak ditemukan" });
      }

      await ctx.db.customer.update({
        where: { id: input.id },
        data: {
          name: input.name,
          phone: input.phone,
          address: input.address,
          birthDate: input.birthDate ?? null,
          note: input.note,
        },
        select: { id: true },
      });

      return { ok: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: customerIdSchema }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.customer.findUnique({
        where: { id: input.id },
        select: { id: true },
      });

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Customer tidak ditemukan" });
      }

      await ctx.db.customer.delete({ where: { id: input.id } });

      return { ok: true };
    }),

  createVehicle: protectedProcedure
    .input(
      z.object({
        customerId: customerIdSchema,
        plateNumber: plateNumberSchema,
        brand: vehicleBrandSchema,
        model: vehicleModelSchema,
        year: z.number().int().min(1900).max(2100).optional(),
        color: vehicleOptionalStringSchema,
        engineNumber: vehicleOptionalStringSchema,
        chassisNumber: vehicleOptionalStringSchema,
        currentOdometer: z.number().int().min(0).optional(),
        note: z.string().trim().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const customer = await ctx.db.customer.findUnique({
        where: { id: input.customerId },
        select: { id: true },
      });

      if (!customer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Customer tidak ditemukan" });
      }

      try {
        const vehicle = await ctx.db.vehicle.create({
          data: {
            customerId: input.customerId,
            plateNumber: input.plateNumber,
            brand: input.brand,
            model: input.model,
            year: input.year,
            color: input.color,
            engineNumber: input.engineNumber,
            chassisNumber: input.chassisNumber,
            currentOdometer: input.currentOdometer,
            note: input.note,
          },
          select: { id: true },
        });

        return vehicle;
      } catch (err: unknown) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Plat nomor sudah digunakan",
          });
        }

        throw err;
      }
    }),

  updateVehicle: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        customerId: customerIdSchema,
        plateNumber: plateNumberSchema,
        brand: vehicleBrandSchema,
        model: vehicleModelSchema,
        year: z.number().int().min(1900).max(2100).optional(),
        color: vehicleOptionalStringSchema,
        engineNumber: vehicleOptionalStringSchema,
        chassisNumber: vehicleOptionalStringSchema,
        currentOdometer: z.number().int().min(0).optional(),
        note: z.string().trim().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const vehicle = await ctx.db.vehicle.findUnique({
        where: { id: input.id },
        select: { id: true, customerId: true },
      });

      if (vehicle?.customerId !== input.customerId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Kendaraan tidak ditemukan" });
      }

      try {
        await ctx.db.vehicle.update({
          where: { id: input.id },
          data: {
            plateNumber: input.plateNumber,
            brand: input.brand,
            model: input.model,
            year: input.year,
            color: input.color,
            engineNumber: input.engineNumber,
            chassisNumber: input.chassisNumber,
            currentOdometer: input.currentOdometer,
            note: input.note,
          },
          select: { id: true },
        });

        return { ok: true };
      } catch (err: unknown) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Plat nomor sudah digunakan",
          });
        }

        throw err;
      }
    }),

  deleteVehicle: protectedProcedure
    .input(z.object({ id: z.string().min(1), customerId: customerIdSchema }))
    .mutation(async ({ ctx, input }) => {
      const vehicle = await ctx.db.vehicle.findUnique({
        where: { id: input.id },
        select: { id: true, customerId: true },
      });

      if (vehicle?.customerId !== input.customerId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Kendaraan tidak ditemukan" });
      }

      await ctx.db.vehicle.delete({ where: { id: input.id } });

      return { ok: true };
    }),
});

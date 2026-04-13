import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import { Prisma } from "../../../../generated/prisma";

const moneySchema = z.number().int().min(0).max(2_000_000_000);

const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.union([z.literal(10), z.literal(20), z.literal(50)]).default(10),
  query: z.string().trim().max(120).optional(),
});

const paginationSchemaOptional = paginationSchema.optional().default({});

const unitNameSchema = z
  .string()
  .trim()
  .min(1, "Nama unit wajib diisi")
  .max(30, "Nama unit terlalu panjang");

const productTypeSchema = z.enum(["SPAREPART", "OIL"]);

const productNameSchema = z
  .string()
  .trim()
  .min(2, "Nama produk minimal 2 karakter")
  .max(120, "Nama produk terlalu panjang");

const brandNameSchema = z
  .string()
  .trim()
  .min(2, "Nama brand minimal 2 karakter")
  .max(60, "Nama brand terlalu panjang");

function mapOutdatedPrismaClientError(err: unknown) {
  const msg = err instanceof Error ? err.message : "";
  if (msg.includes("Unknown field `buyPriceDefault`") || msg.includes("Unknown field buyPriceDefault")) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message:
        "Prisma Client belum ter-update (field buyPriceDefault belum dikenal). Jalankan: pnpm prisma db push, pnpm prisma generate, lalu restart dev server.",
    });
  }
}

export const inventoryRouter = createTRPCRouter({
  // Brands
  listBrands: adminProcedure.query(async ({ ctx }) => {
    const db = ctx.db as any;
    if (!db.brand) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          "Model brand belum tersedia. Jalankan prisma db push/migrate + prisma generate, lalu restart dev server.",
      });
    }

    return (await db.brand.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    })) as Array<{ id: string; name: string }>;
  }),

  createBrand: adminProcedure
    .input(z.object({ name: brandNameSchema }))
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db as any;
      try {
        const brand = await db.brand.create({
          data: { name: input.name },
          select: { id: true, name: true },
        });
        return brand as { id: string; name: string };
      } catch (err: unknown) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          throw new TRPCError({ code: "CONFLICT", message: "Nama brand sudah digunakan" });
        }
        throw err;
      }
    }),

  updateBrand: adminProcedure
    .input(z.object({ id: z.string().min(1), name: brandNameSchema }))
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db as any;

      const current = (await db.brand.findUnique({
        where: { id: input.id },
        select: { id: true },
      })) as { id: string } | null;

      if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Brand tidak ditemukan" });

      try {
        await db.brand.update({
          where: { id: input.id },
          data: { name: input.name },
          select: { id: true },
        });
        return { ok: true };
      } catch (err: unknown) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          throw new TRPCError({ code: "CONFLICT", message: "Nama brand sudah digunakan" });
        }
        throw err;
      }
    }),

  deleteBrand: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db as any;

      const current = (await db.brand.findUnique({
        where: { id: input.id },
        select: { id: true },
      })) as { id: string } | null;

      if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Brand tidak ditemukan" });

      try {
        await db.brand.delete({ where: { id: input.id } });
        return { ok: true };
      } catch (err: unknown) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Brand sedang dipakai oleh product",
          });
        }
        throw err;
      }
    }),

  // Units
  listUnits: adminProcedure.query(async ({ ctx }) => {
    const db = ctx.db as any;
    if (!db.unit) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          "Model inventory belum tersedia. Jalankan prisma db push/migrate + prisma generate, lalu restart dev server.",
      });
    }
    return (await db.unit.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    })) as Array<{ id: string; name: string }>;
  }),

  createUnit: adminProcedure
    .input(z.object({ name: unitNameSchema }))
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db as any;
      try {
        const unit = await db.unit.create({
          data: { name: input.name },
          select: { id: true, name: true },
        });
        return unit as { id: string; name: string };
      } catch (err: unknown) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          throw new TRPCError({ code: "CONFLICT", message: "Nama unit sudah digunakan" });
        }
        throw err;
      }
    }),

  updateUnit: adminProcedure
    .input(z.object({ id: z.string().min(1), name: unitNameSchema }))
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db as any;
      const current = (await db.unit.findUnique({
        where: { id: input.id },
        select: { id: true },
      })) as { id: string } | null;

      if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Unit tidak ditemukan" });

      try {
        await db.unit.update({
          where: { id: input.id },
          data: { name: input.name },
          select: { id: true },
        });
        return { ok: true };
      } catch (err: unknown) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          throw new TRPCError({ code: "CONFLICT", message: "Nama unit sudah digunakan" });
        }
        throw err;
      }
    }),

  deleteUnit: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db as any;
      const unit = (await db.unit.findUnique({
        where: { id: input.id },
        select: { id: true },
      })) as { id: string } | null;

      if (!unit) throw new TRPCError({ code: "NOT_FOUND", message: "Unit tidak ditemukan" });

      try {
        await db.unit.delete({ where: { id: input.id } });
        return { ok: true };
      } catch (err: unknown) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Unit sedang dipakai di product",
          });
        }
        throw err;
      }
    }),

  // Products
  listProducts: adminProcedure.input(paginationSchemaOptional).query(async ({ ctx, input }) => {
    const db = ctx.db as any;
    if (!db.product || !db.stockBatch) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          "Model inventory belum tersedia. Jalankan prisma db push/migrate + prisma generate, lalu restart dev server.",
      });
    }
    const q = input.query?.trim();

    const where = q
      ? {
          OR: [
            { name: { contains: q } },
            { brand: { name: { contains: q } } },
            { unit: { name: { contains: q } } },
          ],
        }
      : undefined;

    const skip = (input.page - 1) * input.limit;

    let total: number;
    let items: Array<any>;
    try {
      [total, items] = (await db.$transaction([
        db.product.count({ where }),
        db.product.findMany({
          where,
          orderBy: [{ type: "asc" }, { brand: { name: "asc" } }, { name: "asc" }],
          skip,
          take: input.limit,
          select: {
            id: true,
            name: true,
            type: true,
            brand: { select: { id: true, name: true } },
            buyPriceDefault: true,
            sellPrice: true,
            unit: { select: { id: true, name: true } },
            createdAt: true,
          },
        }),
      ])) as [number, Array<any>];
    } catch (err: unknown) {
      mapOutdatedPrismaClientError(err);
      throw err;
    }

    const ids = items.map((p) => p.id) as string[];

    const grouped = (await db.stockBatch.groupBy({
      by: ["productId"],
      where: { productId: { in: ids }, remaining: { gt: 0 } },
      _sum: { remaining: true },
    })) as Array<{ productId: string; _sum: { remaining: number | null } }>;

    const stockByProductId = new Map(grouped.map((g) => [g.productId, g._sum.remaining ?? 0] as const));

    const latestBatches = (await db.stockBatch.findMany({
      where: { productId: { in: ids } },
      orderBy: { createdAt: "desc" },
      select: { productId: true, buyPrice: true, createdAt: true },
    })) as Array<{ productId: string; buyPrice: number; createdAt: Date }>;

    const lastBuyPriceByProductId = new Map<string, number>();
    for (const b of latestBatches) {
      if (!lastBuyPriceByProductId.has(b.productId)) {
        lastBuyPriceByProductId.set(b.productId, b.buyPrice);
      }
    }

    return {
      total,
      page: input.page,
      limit: input.limit,
      items: items.map((p) => ({
        id: p.id as string,
        name: p.name as string,
        type: p.type as "SPAREPART" | "OIL",
        brand: (p.brand?.name as string | undefined) ?? null,
        brandId: (p.brand?.id as string | undefined) ?? null,
        buyPriceDefault: (p.buyPriceDefault as number | undefined) ?? 0,
        lastBuyPrice: lastBuyPriceByProductId.get(p.id as string) ?? null,
        sellPrice: p.sellPrice as number,
        unit: p.unit as { id: string; name: string },
        stockAvailable: stockByProductId.get(p.id as string) ?? 0,
        createdAt: p.createdAt as Date,
      })),
    };
  }),

  getProductById: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const db = ctx.db as any;
      let p:
        | {
            id: string;
            name: string;
            type: "SPAREPART" | "OIL";
            brandId: string | null;
            unitId: string;
            buyPriceDefault: number;
            sellPrice: number;
          }
        | null;
      try {
        p = (await db.product.findUnique({
          where: { id: input.id },
          select: {
            id: true,
            name: true,
            type: true,
            brandId: true,
            unitId: true,
            buyPriceDefault: true,
            sellPrice: true,
          },
        })) as any;
      } catch (err: unknown) {
        mapOutdatedPrismaClientError(err);
        throw err;
      }

      if (!p) throw new TRPCError({ code: "NOT_FOUND", message: "Product tidak ditemukan" });
      return p;
    }),

  createProduct: adminProcedure
    .input(
      z.object({
        name: productNameSchema,
        type: productTypeSchema,
        brandId: z.string().min(1).optional(),
        unitId: z.string().min(1, "Unit wajib dipilih"),
        buyPriceDefault: moneySchema.optional(),
        sellPrice: moneySchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db as any;

      const brandId = input.type === "OIL" ? input.brandId?.trim() : undefined;
      if (input.type === "OIL" && !brandId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Brand wajib dipilih untuk oli" });
      }

      const unit = (await db.unit.findUnique({
        where: { id: input.unitId },
        select: { id: true },
      })) as { id: string } | null;

      if (!unit) throw new TRPCError({ code: "NOT_FOUND", message: "Unit tidak ditemukan" });

      if (brandId) {
        const brand = (await db.brand.findUnique({
          where: { id: brandId },
          select: { id: true },
        })) as { id: string } | null;
        if (!brand) throw new TRPCError({ code: "NOT_FOUND", message: "Brand tidak ditemukan" });
      }

      let created: { id: string };
      try {
        created = (await db.product.create({
          data: {
            name: input.name,
            type: input.type,
            brandId: brandId ?? null,
            unitId: input.unitId,
            buyPriceDefault: input.buyPriceDefault ?? 0,
            sellPrice: input.sellPrice,
          },
          select: { id: true },
        })) as { id: string };
      } catch (err: unknown) {
        mapOutdatedPrismaClientError(err);
        throw err;
      }

      return created as { id: string };
    }),

  updateProduct: adminProcedure
    .input(
      z.object({
        id: z.string().min(1),
        name: productNameSchema,
        type: productTypeSchema,
        brandId: z.string().min(1).optional(),
        unitId: z.string().min(1, "Unit wajib dipilih"),
        buyPriceDefault: moneySchema.optional(),
        sellPrice: moneySchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db as any;

      const current = (await db.product.findUnique({
        where: { id: input.id },
        select: { id: true },
      })) as { id: string } | null;

      if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Product tidak ditemukan" });

      const brandId = input.type === "OIL" ? input.brandId?.trim() : undefined;
      if (input.type === "OIL" && !brandId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Brand wajib dipilih untuk oli" });
      }

      const unit = (await db.unit.findUnique({
        where: { id: input.unitId },
        select: { id: true },
      })) as { id: string } | null;

      if (!unit) throw new TRPCError({ code: "NOT_FOUND", message: "Unit tidak ditemukan" });

      if (brandId) {
        const brand = (await db.brand.findUnique({
          where: { id: brandId },
          select: { id: true },
        })) as { id: string } | null;
        if (!brand) throw new TRPCError({ code: "NOT_FOUND", message: "Brand tidak ditemukan" });
      }

      try {
        await db.product.update({
          where: { id: input.id },
          data: {
            name: input.name,
            type: input.type,
            brandId: brandId ?? null,
            unitId: input.unitId,
            buyPriceDefault: input.buyPriceDefault ?? 0,
            sellPrice: input.sellPrice,
          },
          select: { id: true },
        });
      } catch (err: unknown) {
        mapOutdatedPrismaClientError(err);
        throw err;
      }

      return { ok: true };
    }),

  deleteProduct: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db as any;
      const current = (await db.product.findUnique({
        where: { id: input.id },
        select: { id: true },
      })) as { id: string } | null;

      if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Product tidak ditemukan" });

      try {
        await db.product.delete({ where: { id: input.id } });
        return { ok: true };
      } catch (err: unknown) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Product tidak bisa dihapus karena sudah dipakai",
          });
        }
        throw err;
      }
    }),

  // Stock In
  stockIn: adminProcedure
    .input(
      z.object({
        productId: z.string().min(1, "Product wajib dipilih"),
        qty: z.number().int().min(1).max(10_000),
        buyPrice: moneySchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db as any;

      const product = (await db.product.findUnique({
        where: { id: input.productId },
        select: { id: true },
      })) as { id: string } | null;

      if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Product tidak ditemukan" });

      let res: { id: string };
      try {
        res = (await db.$transaction(async (tx: any) => {
          const batch = await tx.stockBatch.create({
            data: {
              productId: input.productId,
              qty: input.qty,
              remaining: input.qty,
              buyPrice: input.buyPrice,
            },
            select: { id: true },
          });

          await tx.product.update({
            where: { id: input.productId },
            data: { buyPriceDefault: input.buyPrice },
            select: { id: true },
          });

          await tx.stockMovement.create({
            data: {
              type: "IN",
              productId: input.productId,
              batchId: batch.id,
              qty: input.qty,
              buyPrice: input.buyPrice,
            },
            select: { id: true },
          });

          return batch;
        })) as { id: string };
      } catch (err: unknown) {
        mapOutdatedPrismaClientError(err);
        throw err;
      }

      return { id: res.id } as { id: string };
    }),
});

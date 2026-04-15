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

const stockInHistorySchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.union([z.literal(10), z.literal(20), z.literal(50)]).default(20),
});

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

const productListSelect = Prisma.validator<Prisma.ProductSelect>()({
  id: true,
  name: true,
  type: true,
  brand: { select: { id: true, name: true } },
  buyPriceDefault: true,
  sellPrice: true,
  unit: { select: { id: true, name: true } },
  createdAt: true,
});

type ProductListRow = Prisma.ProductGetPayload<{ select: typeof productListSelect }>;

type ProductListItem = {
  id: string;
  name: string;
  type: "SPAREPART" | "OIL";
  brand: string | null;
  brandId: string | null;
  buyPriceDefault: number;
  lastBuyPrice: number | null;
  sellPrice: number;
  unit: { id: string; name: string };
  stockAvailable: number;
  createdAt: Date;
};

type ListProductsOutput = {
  total: number;
  page: number;
  limit: 10 | 20 | 50;
  items: ProductListItem[];
};

type StockBatchLatest = {
  productId: string;
  buyPrice: number;
  createdAt: Date;
};

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
    return await ctx.db.brand.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
  }),

  createBrand: adminProcedure
    .input(z.object({ name: brandNameSchema }))
    .mutation(async ({ ctx, input }) => {
      try {
        const brand = await ctx.db.brand.create({
          data: { name: input.name },
          select: { id: true, name: true },
        });
        return brand;
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
      const current = await ctx.db.brand.findUnique({
        where: { id: input.id },
        select: { id: true },
      });

      if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Brand tidak ditemukan" });

      try {
        await ctx.db.brand.update({
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
      const current = await ctx.db.brand.findUnique({
        where: { id: input.id },
        select: { id: true },
      });

      if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Brand tidak ditemukan" });

      try {
        await ctx.db.brand.delete({ where: { id: input.id } });
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
    return await ctx.db.unit.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
  }),

  createUnit: adminProcedure
    .input(z.object({ name: unitNameSchema }))
    .mutation(async ({ ctx, input }) => {
      try {
        const unit = await ctx.db.unit.create({
          data: { name: input.name },
          select: { id: true, name: true },
        });
        return unit;
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
      const current = await ctx.db.unit.findUnique({
        where: { id: input.id },
        select: { id: true },
      });

      if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Unit tidak ditemukan" });

      try {
        await ctx.db.unit.update({
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
      const unit = await ctx.db.unit.findUnique({
        where: { id: input.id },
        select: { id: true },
      });

      if (!unit) throw new TRPCError({ code: "NOT_FOUND", message: "Unit tidak ditemukan" });

      try {
        await ctx.db.unit.delete({ where: { id: input.id } });
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

    let total = 0;
    let items: ProductListRow[] = [];
    try {
      const [count, rows] = await ctx.db.$transaction(
        [
          ctx.db.product.count({ where }),
          ctx.db.product.findMany({
            where,
            orderBy: [{ type: "asc" }, { brand: { name: "asc" } }, { name: "asc" }],
            skip,
            take: input.limit,
            select: productListSelect,
          }),
        ] as const,
      );

      total = count;
      items = rows;
    } catch (err: unknown) {
      mapOutdatedPrismaClientError(err);
      throw err;
    }

    const ids: string[] = items.map((p) => p.id);

    const remainingBatches = await ctx.db.stockBatch.findMany({
      where: { productId: { in: ids }, remaining: { gt: 0 } },
      select: { productId: true, remaining: true },
    });

    const stockByProductId = new Map<string, number>();
    for (const b of remainingBatches) {
      stockByProductId.set(b.productId, (stockByProductId.get(b.productId) ?? 0) + b.remaining);
    }

    const latestBatches: StockBatchLatest[] = await ctx.db.stockBatch.findMany({
      where: { productId: { in: ids } },
      orderBy: { createdAt: "desc" },
      select: { productId: true, buyPrice: true, createdAt: true },
    });

    const lastBuyPriceByProductId = new Map<string, number>();
    for (const b of latestBatches) {
      if (!lastBuyPriceByProductId.has(b.productId)) {
        lastBuyPriceByProductId.set(b.productId, b.buyPrice);
      }
    }

    const output: ListProductsOutput = {
      total,
      page: input.page,
      limit: input.limit,
      items: items.map((p: ProductListRow) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        brand: p.brand?.name ?? null,
        brandId: p.brand?.id ?? null,
        buyPriceDefault: p.buyPriceDefault,
        lastBuyPrice: lastBuyPriceByProductId.get(p.id) ?? null,
        sellPrice: p.sellPrice,
        unit: p.unit,
        stockAvailable: stockByProductId.get(p.id) ?? 0,
        createdAt: p.createdAt,
      })),
    };

    return output;
  }),

  getProductById: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      let p: {
        id: string;
        name: string;
        type: "SPAREPART" | "OIL";
        brandId: string | null;
        unitId: string;
        buyPriceDefault: number;
        sellPrice: number;
      } | null;
      try {
        p = await ctx.db.product.findUnique({
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
        });
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
      const brandId = input.type === "OIL" ? input.brandId?.trim() : undefined;
      if (input.type === "OIL" && !brandId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Brand wajib dipilih untuk oli" });
      }

      const unit = await ctx.db.unit.findUnique({
        where: { id: input.unitId },
        select: { id: true },
      });

      if (!unit) throw new TRPCError({ code: "NOT_FOUND", message: "Unit tidak ditemukan" });

      if (brandId) {
        const brand = await ctx.db.brand.findUnique({
          where: { id: brandId },
          select: { id: true },
        });
        if (!brand) throw new TRPCError({ code: "NOT_FOUND", message: "Brand tidak ditemukan" });
      }

      let created: { id: string };
      try {
        created = await ctx.db.product.create({
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

      return created;
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
      const current = await ctx.db.product.findUnique({
        where: { id: input.id },
        select: { id: true },
      });

      if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Product tidak ditemukan" });

      const brandId = input.type === "OIL" ? input.brandId?.trim() : undefined;
      if (input.type === "OIL" && !brandId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Brand wajib dipilih untuk oli" });
      }

      const unit = await ctx.db.unit.findUnique({
        where: { id: input.unitId },
        select: { id: true },
      });

      if (!unit) throw new TRPCError({ code: "NOT_FOUND", message: "Unit tidak ditemukan" });

      if (brandId) {
        const brand = await ctx.db.brand.findUnique({
          where: { id: brandId },
          select: { id: true },
        });
        if (!brand) throw new TRPCError({ code: "NOT_FOUND", message: "Brand tidak ditemukan" });
      }

      try {
        await ctx.db.product.update({
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
      const current = await ctx.db.product.findUnique({
        where: { id: input.id },
        select: { id: true },
      });

      if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Product tidak ditemukan" });

      try {
        await ctx.db.product.delete({ where: { id: input.id } });
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
  stockInHistory: adminProcedure
    .input(stockInHistorySchema.optional().default({}))
    .query(async ({ ctx, input }) => {
      const skip = (input.page - 1) * input.limit;

      const [total, rows] = await ctx.db.$transaction([
        ctx.db.stockMovement.count({ where: { type: "IN" } }),
        ctx.db.stockMovement.findMany({
          where: { type: "IN" },
          orderBy: { createdAt: "desc" },
          skip,
          take: input.limit,
          select: {
            id: true,
            qty: true,
            buyPrice: true,
            invoiceNumber: true,
            note: true,
            createdAt: true,
            product: {
              select: {
                id: true,
                name: true,
                type: true,
                brand: { select: { name: true } },
                unit: { select: { name: true } },
              },
            },
          },
        }),
      ] as const);

      return {
        total,
        page: input.page,
        limit: input.limit,
        items: rows.map((r) => ({
          id: r.id,
          qty: r.qty,
          buyPrice: r.buyPrice ?? 0,
          invoiceNumber: r.invoiceNumber,
          note: r.note,
          createdAt: r.createdAt,
          product: {
            id: r.product.id,
            name: r.product.name,
            type: r.product.type,
            brand: r.product.brand?.name ?? null,
            unit: r.product.unit.name,
          },
        })),
      };
    }),

  stockIn: adminProcedure
    .input(
      z.object({
        productId: z.string().min(1, "Product wajib dipilih"),
        qty: z.number().int().min(1).max(10_000),
        buyPrice: moneySchema,
        invoiceNumber: z.string().trim().min(1).max(60).optional(),
        note: z.string().trim().min(1).max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const product = await ctx.db.product.findUnique({
        where: { id: input.productId },
        select: { id: true },
      });

      if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Product tidak ditemukan" });

      let res: { id: string };
      try {
        res = await ctx.db.$transaction(async (tx) => {
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
              invoiceNumber: input.invoiceNumber,
              note: input.note,
            },
            select: { id: true },
          });

          return batch;
        });
      } catch (err: unknown) {
        mapOutdatedPrismaClientError(err);
        throw err;
      }

      return { id: res.id };
    }),
});

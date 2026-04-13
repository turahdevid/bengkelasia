import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { Prisma } from "../../../../generated/prisma";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

const woIdSchema = z.string().min(1);

const woStatusSchema = z.enum([
  "DRAFT",
  "ANTRIAN",
  "PROSES",
  "SELESAI",
  "DIAMBIL",
  "OPEN",
  "DONE",
  "CANCELLED",
]);

const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.union([z.literal(10), z.literal(20), z.literal(50)]).default(10),
  query: z.string().trim().max(120).optional(),
});

const moneySchema = z.number().int().min(0).max(2_000_000_000);
const percentSchema = z.number().int().min(0).max(100);

const optionalNoteSchema = z.string().trim().min(1).max(10_000).optional();

const isoDateTimeSchema = z
  .string()
  .trim()
  .min(1)
  .refine(
    (v) => {
      const d = new Date(v);
      return !Number.isNaN(d.getTime());
    },
    { message: "Tanggal tidak valid" },
  );

const woNumberPrefixForDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `WO-${y}${m}${day}`;
};

function formatWoNumber(prefix: string, seq: number) {
  const padded = String(seq).padStart(4, "0");
  return `${prefix}-${padded}`;
}

function parseWoSequence(woNumber: string) {
  const parts = woNumber.split("-");
  const seqStr = parts.at(-1);
  if (!seqStr) return null;
  const n = Number(seqStr);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function assertStatusTransition(params: { current: string; next: string }) {
  const { current, next } = params;
  const ok =
    (current === "DRAFT" && next === "ANTRIAN") ||
    (current === "ANTRIAN" && next === "PROSES") ||
    (current === "PROSES" && next === "SELESAI") ||
    (current === "SELESAI" && next === "DIAMBIL");

  if (!ok) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Transisi status tidak valid: ${current} -> ${next}`,
    });
  }
}

const customerSearchSchema = z.object({
  query: z.string().trim().min(1).max(120),
  limit: z.number().int().min(1).max(20).default(10),
});

const vehicleListSchema = z.object({
  customerId: z.string().min(1),
});

const sparepartSearchSchema = z.object({
  query: z.string().trim().max(120).optional(),
  limit: z.number().int().min(1).max(50).default(20),
});

const oilSearchSchema = z.object({
  query: z.string().trim().max(120).optional(),
  limit: z.number().int().min(1).max(100).default(50),
});

const productSearchSchema = z.object({
  query: z.string().trim().max(120).optional(),
  limit: z.number().int().min(1).max(100).default(50),
});

const addInventoryItemSchema = z.object({
  workOrderId: z.string().min(1),
  productId: z.string().min(1),
  qty: z.number().int().min(1).max(10_000),
});

const replaceJasaItemsSchema = z.object({
  workOrderId: z.string().min(1),
  items: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(190),
        qty: z.number().int().min(1).max(10_000),
        price: moneySchema,
      }),
    )
    .max(200),
});

const workOrderItemInputSchema = z.object({
  type: z.enum(["JASA", "SPAREPART", "OLI"]),
  name: z.string().trim().min(1).max(190),
  qty: z.number().int().min(1).max(10_000),
  price: moneySchema,
  sparepartId: z.string().min(1).optional(),
  oilId: z.string().min(1).optional(),
});

type WorkOrderItemInput = z.infer<typeof workOrderItemInputSchema>;

function calcSubtotal(items: WorkOrderItemInput[]) {
  return items.reduce((acc, it) => acc + it.qty * it.price, 0);
}

async function getStockAvailableByProductId(tx: {
  stockBatch: {
    groupBy: Function;
  };
}, productIds: string[]) {
  if (productIds.length === 0) return new Map<string, number>();

  const grouped = (await (tx.stockBatch.groupBy as any)({
    by: ["productId"],
    where: { productId: { in: productIds }, remaining: { gt: 0 } },
    _sum: { remaining: true },
  })) as Array<{ productId: string; _sum: { remaining: number | null } }>;

  return new Map(grouped.map((g) => [g.productId, g._sum.remaining ?? 0] as const));
}

async function fifoDeductAndComputeHpp(params: {
  tx: any;
  workOrderId: string;
  productId: string;
  qty: number;
  itemType: "SPAREPART" | "OLI";
}) {
  const { tx, workOrderId, productId, qty, itemType } = params;

  const product = await tx.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      name: true,
      type: true,
      brand: { select: { name: true } },
      sellPrice: true,
    },
  });

  if (!product) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Produk tidak ditemukan" });
  }

  if (itemType === "SPAREPART" && product.type !== "SPAREPART") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Produk bukan sparepart" });
  }
  if (itemType === "OLI" && product.type !== "OIL") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Produk bukan oli" });
  }

  const batches = await tx.stockBatch.findMany({
    where: { productId, remaining: { gt: 0 } },
    orderBy: { createdAt: "asc" },
    select: { id: true, remaining: true, buyPrice: true },
  });

  let need = qty;
  const plan: Array<{ batchId: string; take: number; buyPrice: number; remainingBefore: number }> = [];

  for (const b of batches) {
    if (need <= 0) break;
    const take = Math.min(need, b.remaining);
    if (take <= 0) continue;
    plan.push({ batchId: b.id, take, buyPrice: b.buyPrice, remainingBefore: b.remaining });
    need -= take;
  }

  if (need > 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Stok tidak cukup" });
  }

  const totalHpp = plan.reduce((acc, p) => acc + p.take * p.buyPrice, 0);
  const hppPerItem = Math.floor(totalHpp / qty);

  const itemName =
    itemType === "OLI"
      ? `${product.brand?.name ?? ""} ${product.name}`.trim()
      : product.name;

  const woItem = await tx.workOrderItem.create({
    data: {
      workOrderId,
      type: itemType,
      productId: product.id,
      name: itemName,
      qty,
      price: product.sellPrice,
      hpp: hppPerItem,
    },
    select: { id: true },
  });

  for (const step of plan) {
    const newRemaining = step.remainingBefore - step.take;
    await tx.stockBatch.update({
      where: { id: step.batchId },
      data: { remaining: newRemaining },
      select: { id: true },
    });
  }

  if (plan.length > 0) {
    await tx.stockMovement.createMany({
      data: plan.map((p) => ({
        type: "OUT",
        productId: product.id,
        batchId: p.batchId,
        qty: p.take,
        buyPrice: p.buyPrice,
        workOrderId,
        workOrderItemId: woItem.id,
      })),
    });
  }

  return { id: woItem.id };
}

function calcGrandTotal(params: {
  itemsSubtotal: number;
  discountPercent: number;
  taxPercent: number;
}) {
  const discountAmount = Math.floor((params.itemsSubtotal * params.discountPercent) / 100);
  const afterDiscount = Math.max(0, params.itemsSubtotal - discountAmount);
  const taxAmount = Math.floor((afterDiscount * params.taxPercent) / 100);
  return afterDiscount + taxAmount;
}

const upsertWorkOrderSchema = z
  .object({
    id: woIdSchema.optional(),

    // Customer & Vehicle
    customerId: z.string().min(1).optional(),
    vehicleId: z.string().min(1).optional(),
    newCustomer: z
      .object({
        name: z.string().trim().min(2).max(120),
        phone: z.string().trim().min(6).max(30),
        address: z.string().trim().min(1).max(500).optional(),
      })
      .optional(),
    newVehicle: z
      .object({
        plateNumber: z
          .string()
          .trim()
          .min(3)
          .max(16)
          .transform((v) => v.toUpperCase().replace(/\s+/g, " ")),
        brand: z.string().trim().min(1).max(60),
        model: z.string().trim().min(1).max(60),
        currentOdometer: z.number().int().min(0).max(2_000_000).optional(),
      })
      .optional(),

    // Order Info
    woNumber: z.string().trim().min(1).max(50),
    dateTime: isoDateTimeSchema,
    odo: z.number().int().min(0).max(2_000_000).optional(),
    complaint: optionalNoteSchema,

    advisorId: z.string().min(1).optional(),
    mechanicIds: z.array(z.string().min(1)).max(20),

    // Items
    items: z.array(workOrderItemInputSchema).max(500),

    // Checking & Reminder
    preCheck: optionalNoteSchema,
    postCheck: optionalNoteSchema,
    estimatedDoneAt: isoDateTimeSchema.optional(),
    reminderNextOdo: z.number().int().min(0).max(2_000_000).optional(),
    reminderNextDate: isoDateTimeSchema.optional(),

    // Payment
    dp: moneySchema.default(0),
    discountPercent: percentSchema.default(0),
    taxPercent: percentSchema.default(0),
    paidAmount: moneySchema.default(0),
    paymentMethod: z.enum(["CASH", "TRANSFER"]).default("CASH"),
  })
  .superRefine((val, ctx) => {
    const usingExisting = Boolean(val.customerId) && Boolean(val.vehicleId);
    const usingNew = Boolean(val.newCustomer) && Boolean(val.newVehicle);

    if (!usingExisting && !usingNew) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Pilih customer+kendaraan atau input customer+kendaraan baru",
        path: ["customerId"],
      });
    }

    if (usingExisting && usingNew) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Tidak boleh memilih customer existing dan input customer baru sekaligus",
        path: ["newCustomer"],
      });
    }

    for (const it of val.items) {
      if (it.type === "SPAREPART" && !it.sparepartId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Sparepart wajib dipilih",
          path: ["items"],
        });
      }
      if (it.type === "OLI" && !it.oilId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Oli wajib dipilih",
          path: ["items"],
        });
      }
    }
  });

export const serviceRouter = createTRPCRouter({
  getNextWoNumber: protectedProcedure.query(async ({ ctx }) => {
    const prefix = woNumberPrefixForDate(new Date());

    const latest = await ctx.db.workOrder.findFirst({
      where: { woNumber: { startsWith: `${prefix}-` } },
      orderBy: { createdAt: "desc" },
      select: { woNumber: true },
    });

    const lastSeq = latest ? parseWoSequence(latest.woNumber) : null;
    const seq = (lastSeq ?? 0) + 1;

    return { woNumber: formatWoNumber(prefix, seq) };
  }),

  recent: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(20).default(10),
      }),
    )
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.workOrder.findMany({
        orderBy: { createdAt: "desc" },
        take: input.limit,
        select: {
          id: true,
          woNumber: true,
          status: true,
          createdAt: true,
          grandTotal: true,
          customer: { select: { name: true, phone: true } },
          vehicle: { select: { plateNumber: true, brand: true, model: true } },
        },
      });

      return rows;
    }),

  createDraft: protectedProcedure
    .input(
      z
        .object({
          dateTime: isoDateTimeSchema.optional(),
        })
        .optional(),
    )
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db as any;
      const prefix = woNumberPrefixForDate(new Date());

      const latest = await db.workOrder.findFirst({
        where: { woNumber: { startsWith: `${prefix}-` } },
        orderBy: { createdAt: "desc" },
        select: { woNumber: true },
      });

      const lastSeq = latest ? parseWoSequence(latest.woNumber) : null;
      const seq = (lastSeq ?? 0) + 1;
      const woNumber = formatWoNumber(prefix, seq);

      try {
        const wo = await db.workOrder.create({
          data: {
            woNumber,
            status: "DRAFT",
            ...(input?.dateTime ? { createdAt: new Date(input.dateTime) } : {}),
          },
          select: { id: true, woNumber: true, status: true },
        });

        return wo;
      } catch (err: unknown) {
        if (err instanceof Prisma.PrismaClientKnownRequestError) {
          if (err.code === "P2002") {
            throw new TRPCError({
              code: "CONFLICT",
              message: "Nomor WO sudah dipakai. Silakan coba lagi.",
            });
          }
        }

        if (err instanceof Error && err.name === "PrismaClientValidationError") {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message:
              "Prisma Client / database belum sinkron untuk WorkOrder. Jalankan: pnpm prisma db push, pnpm prisma generate, lalu restart dev server.",
          });
        }

        throw err;
      }
    }),

  searchCustomers: protectedProcedure
    .input(customerSearchSchema)
    .query(async ({ ctx, input }) => {
      const q = input.query.trim();

      const items = await ctx.db.customer.findMany({
        where: {
          OR: [{ name: { contains: q } }, { phone: { contains: q } }],
        },
        orderBy: { createdAt: "desc" },
        take: input.limit,
        select: {
          id: true,
          name: true,
          phone: true,
          address: true,
        },
      });

      return items;
    }),

  listProductsSparepart: protectedProcedure
    .input(productSearchSchema)
    .query(async ({ ctx, input }) => {
      const q = input.query?.trim();
      const db = ctx.db as any;

      const items = await db.product.findMany({
        where: {
          type: "SPAREPART",
          ...(q
            ? {
                OR: [
                  { name: { contains: q } },
                  { brand: { name: { contains: q } } },
                ],
              }
            : {}),
        },
        orderBy: [{ name: "asc" }],
        take: input.limit,
        select: {
          id: true,
          name: true,
          brand: { select: { name: true } },
          sellPrice: true,
        },
      });

      const stockByProductId = await getStockAvailableByProductId(db, items.map((p: { id: string }) => p.id));

      return items.map((p: any) => ({
        id: p.id as string,
        name: p.name as string,
        brand: (p.brand?.name as string | undefined) ?? null,
        sellPrice: p.sellPrice as number,
        stockAvailable: stockByProductId.get(p.id as string) ?? 0,
      }));
    }),

  listVehiclesByCustomer: protectedProcedure
    .input(vehicleListSchema)
    .query(async ({ ctx, input }) => {
      const items = await ctx.db.vehicle.findMany({
        where: { customerId: input.customerId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          plateNumber: true,
          brand: true,
          model: true,
          currentOdometer: true,
        },
      });

      return items;
    }),

  listMechanics: protectedProcedure.query(async ({ ctx }) => {
    const items = await ctx.db.user.findMany({
      where: { role: { name: "mekanik" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    });

    return items;
  }),

  listAdvisors: protectedProcedure.query(async ({ ctx }) => {
    const items = await ctx.db.user.findMany({
      where: { role: { name: { in: ["kasir", "admin", "owner"] } } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    });

    return items;
  }),

  listSpareparts: protectedProcedure
    .input(sparepartSearchSchema)
    .query(async ({ ctx, input }) => {
      const q = input.query?.trim();

      const items = await ctx.db.sparepart.findMany({
        where: {
          isActive: true,
          ...(q
            ? {
                OR: [{ name: { contains: q } }, { brand: { contains: q } }],
              }
            : {}),
        },
        orderBy: [{ brand: "asc" }, { name: "asc" }],
        take: input.limit,
        select: {
          id: true,
          name: true,
          brand: true,
          price: true,
        },
      });

      return items;
    }),

  listOilsGrouped: protectedProcedure.input(oilSearchSchema).query(async ({ ctx, input }) => {
    const q = input.query?.trim();

    const oils = await ctx.db.oil.findMany({
      where: {
        isActive: true,
        ...(q
          ? {
              OR: [{ name: { contains: q } }, { brand: { contains: q } }],
            }
          : {}),
      },
      orderBy: [{ brand: "asc" }, { name: "asc" }],
      take: input.limit,
      select: { id: true, brand: true, name: true, price: true },
    });

    const byBrand = new Map<string, Array<{ id: string; name: string; price: number }>>();

    for (const o of oils) {
      const list = byBrand.get(o.brand) ?? [];
      list.push({ id: o.id, name: o.name, price: o.price });
      byBrand.set(o.brand, list);
    }

    return Array.from(byBrand.entries()).map(([brand, items]) => ({ brand, items }));
  }),

  listProductsOilGrouped: protectedProcedure
    .input(productSearchSchema)
    .query(async ({ ctx, input }) => {
      const q = input.query?.trim();
      const db = ctx.db as any;

      const items = await db.product.findMany({
        where: {
          type: "OIL",
          ...(q
            ? {
                OR: [
                  { name: { contains: q } },
                  { brand: { name: { contains: q } } },
                ],
              }
            : {}),
        },
        orderBy: [{ brand: { name: "asc" } }, { name: "asc" }],
        take: input.limit,
        select: {
          id: true,
          name: true,
          brand: { select: { name: true } },
          sellPrice: true,
        },
      });

      const stockByProductId = await getStockAvailableByProductId(db, items.map((p: { id: string }) => p.id));

      const byBrand = new Map<
        string,
        Array<{ id: string; name: string; brand: string; sellPrice: number; stockAvailable: number }>
      >();

      for (const p of items) {
        const brand = ((p.brand?.name as string | undefined) ?? "-").trim() || "-";
        const arr = byBrand.get(brand) ?? [];
        arr.push({
          id: p.id as string,
          name: p.name as string,
          brand,
          sellPrice: p.sellPrice as number,
          stockAvailable: stockByProductId.get(p.id as string) ?? 0,
        });
        byBrand.set(brand, arr);
      }

      return Array.from(byBrand.entries()).map(([brand, items]) => ({ brand, items }));
    }),

  addSparepartItem: protectedProcedure
    .input(addInventoryItemSchema)
    .mutation(async ({ ctx, input }) => {
      const wo = await ctx.db.workOrder.findUnique({
        where: { id: input.workOrderId },
        select: { id: true },
      });
      if (!wo) throw new TRPCError({ code: "NOT_FOUND", message: "WO tidak ditemukan" });

      return ctx.db.$transaction((tx) =>
        fifoDeductAndComputeHpp({
          tx,
          workOrderId: input.workOrderId,
          productId: input.productId,
          qty: input.qty,
          itemType: "SPAREPART",
        }),
      );
    }),

  addOilItem: protectedProcedure
    .input(addInventoryItemSchema)
    .mutation(async ({ ctx, input }) => {
      const wo = await ctx.db.workOrder.findUnique({
        where: { id: input.workOrderId },
        select: { id: true },
      });
      if (!wo) throw new TRPCError({ code: "NOT_FOUND", message: "WO tidak ditemukan" });

      return ctx.db.$transaction((tx) =>
        fifoDeductAndComputeHpp({
          tx,
          workOrderId: input.workOrderId,
          productId: input.productId,
          qty: input.qty,
          itemType: "OLI",
        }),
      );
    }),

  replaceJasaItems: protectedProcedure
    .input(replaceJasaItemsSchema)
    .mutation(async ({ ctx, input }) => {
      const wo = await ctx.db.workOrder.findUnique({
        where: { id: input.workOrderId },
        select: { id: true },
      });
      if (!wo) throw new TRPCError({ code: "NOT_FOUND", message: "WO tidak ditemukan" });

      await ctx.db.$transaction(async (tx) => {
        await tx.workOrderItem.deleteMany({
          where: {
            workOrderId: input.workOrderId,
            type: "JASA",
          },
        });

        if (input.items.length > 0) {
          await tx.workOrderItem.createMany({
            data: input.items.map((it) => ({
              workOrderId: input.workOrderId,
              type: "JASA",
              name: it.name,
              qty: it.qty,
              price: it.price,
              hpp: 0,
            })),
          });
        }
      });

      return { ok: true };
    }),

  getById: protectedProcedure
    .input(z.object({ id: woIdSchema }))
    .query(async ({ ctx, input }) => {
      const db = ctx.db as any;

      const wo = await db.workOrder.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          woNumber: true,
          status: true,
          customerId: true,
          vehicleId: true,
          advisorId: true,
          advisor: { select: { name: true, email: true } },
          jobType: true,
          odo: true,
          complaint: true,
          preCheck: true,
          postCheck: true,
          estimatedDoneAt: true,
          reminderNextOdo: true,
          reminderNextDate: true,
          dp: true,
          discountPercent: true,
          taxPercent: true,
          subtotal: true,
          grandTotal: true,
          paidAmount: true,
          changeAmount: true,
          paymentMethod: true,
          createdAt: true,
          updatedAt: true,
          customer: { select: { name: true, phone: true, address: true } },
          vehicle: {
            select: {
              plateNumber: true,
              brand: true,
              model: true,
              currentOdometer: true,
            },
          },
          mechanics: { select: { userId: true, user: { select: { name: true } } } },
          items: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              type: true,
              name: true,
              qty: true,
              price: true,
              hpp: true,
              productId: true,
              sparepartId: true,
              oilId: true,
            },
          },
        },
      });

      if (!wo) throw new TRPCError({ code: "NOT_FOUND", message: "WO tidak ditemukan" });

      return wo;
    }),

  updatePartial: protectedProcedure
    .input(
      z.object({
        id: woIdSchema,

        // Customer & Vehicle
        customerId: z.string().min(1).nullable().optional(),
        vehicleId: z.string().min(1).nullable().optional(),
        newCustomer: z
          .object({
            name: z.string().trim().min(2).max(120),
            phone: z.string().trim().min(6).max(30),
            address: z.string().trim().min(1).max(500).optional(),
          })
          .optional(),
        newVehicle: z
          .object({
            plateNumber: z
              .string()
              .trim()
              .min(3)
              .max(16)
              .transform((v) => v.toUpperCase().replace(/\s+/g, " ")),
            brand: z.string().trim().min(1).max(60),
            model: z.string().trim().min(1).max(60),
            currentOdometer: z.number().int().min(0).max(2_000_000).optional(),
          })
          .optional(),

        // Order Info
        woNumber: z.string().trim().min(1).max(50).optional(),
        dateTime: isoDateTimeSchema.optional(),
        jobType: z.string().trim().min(1).max(120).nullable().optional(),
        odo: z.number().int().min(0).max(2_000_000).nullable().optional(),
        complaint: optionalNoteSchema.nullable().optional(),

        advisorId: z.string().min(1).nullable().optional(),
        mechanicIds: z.array(z.string().min(1)).max(20).optional(),

        // Checking & Reminder
        preCheck: optionalNoteSchema.nullable().optional(),
        postCheck: optionalNoteSchema.nullable().optional(),
        estimatedDoneAt: isoDateTimeSchema.nullable().optional(),
        reminderNextOdo: z.number().int().min(0).max(2_000_000).nullable().optional(),
        reminderNextDate: isoDateTimeSchema.nullable().optional(),

        // Payment
        dp: moneySchema.optional(),
        discountPercent: percentSchema.optional(),
        taxPercent: percentSchema.optional(),
        paidAmount: moneySchema.optional(),
        paymentMethod: z.enum(["CASH", "TRANSFER"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db as any;
      const current = await ctx.db.workOrder.findUnique({
        where: { id: input.id },
        select: { id: true, status: true },
      });
      if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "WO tidak ditemukan" });

      const res = await db.$transaction(async (tx: any) => {
        let customerId: string | null | undefined = input.customerId;
        let vehicleId: string | null | undefined = input.vehicleId;

        if (input.newCustomer || input.newVehicle) {
          if (!input.newCustomer || !input.newVehicle) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Jika input customer baru, kendaraan baru juga wajib diisi (dan sebaliknya)",
            });
          }

          const customer = await tx.customer.create({
            data: {
              name: input.newCustomer.name,
              phone: input.newCustomer.phone,
              address: input.newCustomer.address,
            },
            select: { id: true },
          });

          const vehicle = await tx.vehicle.create({
            data: {
              customerId: customer.id,
              plateNumber: input.newVehicle.plateNumber,
              brand: input.newVehicle.brand,
              model: input.newVehicle.model,
              currentOdometer: input.newVehicle.currentOdometer,
            },
            select: { id: true },
          });

          customerId = customer.id;
          vehicleId = vehicle.id;
        }

        if (customerId && vehicleId) {
          const v = await tx.vehicle.findUnique({
            where: { id: vehicleId },
            select: { id: true, customerId: true },
          });
          if (!v || v.customerId !== customerId) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Kendaraan tidak sesuai customer",
            });
          }
        }

        const updated = await tx.workOrder.update({
          where: { id: input.id },
          data: {
            ...(input.woNumber ? { woNumber: input.woNumber } : {}),
            ...(input.dateTime ? { createdAt: new Date(input.dateTime) } : {}),

            ...(input.jobType !== undefined ? { jobType: input.jobType } : {}),

            ...(customerId !== undefined ? { customerId } : {}),
            ...(vehicleId !== undefined ? { vehicleId } : {}),

            ...(input.advisorId !== undefined ? { advisorId: input.advisorId } : {}),
            ...(input.odo !== undefined ? { odo: input.odo } : {}),
            ...(input.complaint !== undefined ? { complaint: input.complaint } : {}),
            ...(input.preCheck !== undefined ? { preCheck: input.preCheck } : {}),
            ...(input.postCheck !== undefined ? { postCheck: input.postCheck } : {}),
            ...(input.estimatedDoneAt !== undefined
              ? { estimatedDoneAt: input.estimatedDoneAt ? new Date(input.estimatedDoneAt) : null }
              : {}),
            ...(input.reminderNextOdo !== undefined ? { reminderNextOdo: input.reminderNextOdo } : {}),
            ...(input.reminderNextDate !== undefined
              ? { reminderNextDate: input.reminderNextDate ? new Date(input.reminderNextDate) : null }
              : {}),

            ...(input.dp !== undefined ? { dp: input.dp } : {}),
            ...(input.discountPercent !== undefined ? { discountPercent: input.discountPercent } : {}),
            ...(input.taxPercent !== undefined ? { taxPercent: input.taxPercent } : {}),
            ...(input.paidAmount !== undefined ? { paidAmount: input.paidAmount } : {}),
            ...(input.paymentMethod !== undefined ? { paymentMethod: input.paymentMethod } : {}),
          },
          select: { id: true },
        });

        if (input.mechanicIds) {
          await tx.workOrderMechanic.deleteMany({ where: { workOrderId: updated.id } });
          if (input.mechanicIds.length > 0) {
            await tx.workOrderMechanic.createMany({
              data: input.mechanicIds.map((userId) => ({
                workOrderId: updated.id,
                userId,
              })),
              skipDuplicates: true,
            });
          }
        }

        const items = await tx.workOrderItem.findMany({
          where: { workOrderId: updated.id },
          select: { qty: true, price: true },
        });

        const subtotal = items.reduce((acc: number, it: { qty: number; price: number }) => acc + it.qty * it.price, 0);
        const woNow = await tx.workOrder.findUnique({
          where: { id: updated.id },
          select: {
            discountPercent: true,
            taxPercent: true,
            paidAmount: true,
          },
        });

        const grandTotal = calcGrandTotal({
          itemsSubtotal: subtotal,
          discountPercent: woNow?.discountPercent ?? 0,
          taxPercent: woNow?.taxPercent ?? 0,
        });
        const changeAmount = Math.max(0, (woNow?.paidAmount ?? 0) - grandTotal);

        await tx.workOrder.update({
          where: { id: updated.id },
          data: { subtotal, grandTotal, changeAmount },
          select: { id: true },
        });

        return updated;
      });

      return { id: res.id };
    }),

  setStatus: protectedProcedure
    .input(
      z.object({
        id: woIdSchema,
        status: woStatusSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db as any;
      const wo = await ctx.db.workOrder.findUnique({
        where: { id: input.id },
        select: { id: true, status: true },
      });
      if (!wo) throw new TRPCError({ code: "NOT_FOUND", message: "WO tidak ditemukan" });

      if (wo.status !== input.status) {
        assertStatusTransition({ current: wo.status, next: input.status });
      }

      await db.workOrder.update({
        where: { id: input.id },
        data: { status: input.status },
        select: { id: true },
      });

      return { ok: true };
    }),

  searchWorkOrders: protectedProcedure
    .input(paginationSchema)
    .query(async ({ ctx, input }) => {
      const q = input.query?.trim();

      const where = q
        ? {
            OR: [
              { woNumber: { contains: q } },
              { customer: { name: { contains: q } } },
              { customer: { phone: { contains: q } } },
              { vehicle: { plateNumber: { contains: q } } },
            ],
          }
        : undefined;

      const skip = (input.page - 1) * input.limit;

      const [total, items] = await ctx.db.$transaction([
        ctx.db.workOrder.count({ where }),
        ctx.db.workOrder.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: input.limit,
          select: {
            id: true,
            woNumber: true,
            status: true,
            createdAt: true,
            grandTotal: true,
            customer: { select: { name: true, phone: true } },
            vehicle: { select: { plateNumber: true, brand: true, model: true } },
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

  upsert: protectedProcedure
    .input(upsertWorkOrderSchema)
    .mutation(async ({ ctx, input }) => {
      const subtotal = calcSubtotal(input.items);
      const grandTotal = calcGrandTotal({
        itemsSubtotal: subtotal,
        discountPercent: input.discountPercent,
        taxPercent: input.taxPercent,
      });

      const dp = input.dp;
      const paidAmount = input.paidAmount;
      const changeAmount = Math.max(0, paidAmount - grandTotal);

      try {
        const result = await ctx.db.$transaction(async (tx) => {
          let customerId: string;
          let vehicleId: string;

          if (input.newCustomer && input.newVehicle) {
            const customer = await tx.customer.create({
              data: {
                name: input.newCustomer.name,
                phone: input.newCustomer.phone,
                address: input.newCustomer.address,
              },
              select: { id: true },
            });

            customerId = customer.id;

            const vehicle = await tx.vehicle.create({
              data: {
                customerId: customerId,
                plateNumber: input.newVehicle.plateNumber,
                brand: input.newVehicle.brand,
                model: input.newVehicle.model,
                currentOdometer: input.newVehicle.currentOdometer,
              },
              select: { id: true },
            });

            vehicleId = vehicle.id;
          } else {
            if (!input.customerId || !input.vehicleId) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: "Customer & kendaraan wajib dipilih",
              });
            }

            const vehicle = await tx.vehicle.findUnique({
              where: { id: input.vehicleId },
              select: { id: true, customerId: true },
            });

            if (vehicle?.customerId !== input.customerId) {
              throw new TRPCError({
                code: "NOT_FOUND",
                message: "Kendaraan tidak ditemukan untuk customer tersebut",
              });
            }

            customerId = input.customerId;
            vehicleId = input.vehicleId;
          }

          const wo = input.id
            ? await tx.workOrder.update({
                where: { id: input.id },
                data: {
                  woNumber: input.woNumber,
                  customerId,
                  vehicleId,
                  advisorId: input.advisorId ?? null,
                  odo: input.odo ?? null,
                  complaint: input.complaint ?? null,
                  preCheck: input.preCheck ?? null,
                  postCheck: input.postCheck ?? null,
                  estimatedDoneAt: input.estimatedDoneAt
                    ? new Date(input.estimatedDoneAt)
                    : null,
                  reminderNextOdo: input.reminderNextOdo ?? null,
                  reminderNextDate: input.reminderNextDate
                    ? new Date(input.reminderNextDate)
                    : null,
                  dp,
                  discountPercent: input.discountPercent,
                  taxPercent: input.taxPercent,
                  subtotal,
                  grandTotal,
                  paidAmount,
                  changeAmount,
                  paymentMethod: input.paymentMethod,
                  createdAt: new Date(input.dateTime),
                },
                select: { id: true },
              })
            : await tx.workOrder.create({
                data: {
                  woNumber: input.woNumber,
                  status: "OPEN",
                  customerId,
                  vehicleId,
                  advisorId: input.advisorId ?? null,
                  odo: input.odo ?? null,
                  complaint: input.complaint ?? null,
                  preCheck: input.preCheck ?? null,
                  postCheck: input.postCheck ?? null,
                  estimatedDoneAt: input.estimatedDoneAt
                    ? new Date(input.estimatedDoneAt)
                    : null,
                  reminderNextOdo: input.reminderNextOdo ?? null,
                  reminderNextDate: input.reminderNextDate
                    ? new Date(input.reminderNextDate)
                    : null,
                  dp,
                  discountPercent: input.discountPercent,
                  taxPercent: input.taxPercent,
                  subtotal,
                  grandTotal,
                  paidAmount,
                  changeAmount,
                  paymentMethod: input.paymentMethod,
                  createdAt: new Date(input.dateTime),
                },
                select: { id: true },
              });

          await tx.workOrderMechanic.deleteMany({ where: { workOrderId: wo.id } });
          if (input.mechanicIds.length > 0) {
            await tx.workOrderMechanic.createMany({
              data: input.mechanicIds.map((userId) => ({
                workOrderId: wo.id,
                userId,
              })),
              skipDuplicates: true,
            });
          }

          await tx.workOrderItem.deleteMany({
            where: {
              workOrderId: wo.id,
              type: "JASA",
            },
          });

          const jasaItems = input.items.filter((it) => it.type === "JASA");
          if (jasaItems.length > 0) {
            await tx.workOrderItem.createMany({
              data: jasaItems.map((it) => ({
                workOrderId: wo.id,
                type: it.type,
                name: it.name,
                qty: it.qty,
                price: it.price,
                hpp: 0,
              })),
            });
          }

          return wo;
        });

        return { id: result.id };
      } catch (err: unknown) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          throw new TRPCError({
            code: "CONFLICT",
            message: "WO number atau plat nomor sudah digunakan",
          });
        }

        throw err;
      }
    }),
});

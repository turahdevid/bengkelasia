import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { Prisma } from "../../../../generated/prisma";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

const woIdSchema = z.string().min(1);

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

  getById: protectedProcedure
    .input(z.object({ id: woIdSchema }))
    .query(async ({ ctx, input }) => {
      const wo = await ctx.db.workOrder.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          woNumber: true,
          status: true,
          customerId: true,
          vehicleId: true,
          advisorId: true,
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
              sparepartId: true,
              oilId: true,
            },
          },
        },
      });

      if (!wo) throw new TRPCError({ code: "NOT_FOUND", message: "WO tidak ditemukan" });

      return wo;
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

          await tx.workOrderItem.deleteMany({ where: { workOrderId: wo.id } });
          if (input.items.length > 0) {
            await tx.workOrderItem.createMany({
              data: input.items.map((it) => ({
                workOrderId: wo.id,
                type: it.type,
                name: it.name,
                qty: it.qty,
                price: it.price,
                sparepartId: it.sparepartId ?? null,
                oilId: it.oilId ?? null,
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

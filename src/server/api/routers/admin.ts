import { z } from "zod";

import {
  adminProcedure,
  createTRPCRouter,
  permissionProcedure,
} from "~/server/api/trpc";

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function formatDayLabelId(d: Date) {
  // e.g. Mon, Tue in Indonesian locale
  return new Intl.DateTimeFormat("id-ID", { weekday: "short" }).format(d);
}

export const adminRouter = createTRPCRouter({
  getAdminSummary: adminProcedure.query(({ ctx }) => {
    return {
      userId: ctx.session.user.id,
      role: ctx.session.user.role.name,
      permissions: ctx.session.user.permissions,
    };
  }),

  getHeaderNotifications: adminProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const tomorrowStart = addDays(todayStart, 1);
    const todayMonth = now.getMonth();
    const todayDate = now.getDate();

    const birthdayCustomers = await ctx.db.customer.findMany({
      where: { birthDate: { not: null } },
      select: { id: true, name: true, phone: true, birthDate: true },
    });

    const todaysBirthdays = birthdayCustomers
      .filter((c) => {
        const d = c.birthDate ? new Date(c.birthDate) : null;
        if (!d) return false;
        return d.getMonth() === todayMonth && d.getDate() === todayDate;
      })
      .slice(0, 50);

    await Promise.all(
      todaysBirthdays.map((c) =>
        ctx.db.birthdayReminder.upsert({
          where: {
            customerId_reminderDate: {
              customerId: c.id,
              reminderDate: todayStart,
            },
          },
          create: {
            customerId: c.id,
            reminderDate: todayStart,
            status: "PENDING",
          },
          update: {},
        }),
      ),
    );

    const serviceWorkOrders = await ctx.db.workOrder.findMany({
      where: {
        reminderNextDate: { gte: todayStart, lt: tomorrowStart },
      },
      orderBy: { reminderNextDate: "asc" },
      take: 50,
      select: {
        id: true,
        woNumber: true,
        reminderNextDate: true,
        customerId: true,
        vehicleId: true,
        customer: { select: { id: true, name: true, phone: true } },
        vehicle: { select: { id: true, plateNumber: true, brand: true, model: true } },
      },
    });

    await Promise.all(
      serviceWorkOrders.map((w) =>
        ctx.db.serviceReminder.upsert({
          where: {
            workOrderId_dueDate: {
              workOrderId: w.id,
              dueDate: w.reminderNextDate ?? todayStart,
            },
          },
          create: {
            workOrderId: w.id,
            customerId: w.customerId,
            vehicleId: w.vehicleId,
            dueDate: w.reminderNextDate ?? todayStart,
            status: "PENDING",
          },
          update: {
            customerId: w.customerId,
            vehicleId: w.vehicleId,
          },
        }),
      ),
    );

    const [birthdayPending, servicePending] = await Promise.all([
      ctx.db.birthdayReminder.findMany({
        where: {
          reminderDate: todayStart,
          status: "PENDING",
        },
        orderBy: { createdAt: "asc" },
        take: 50,
        select: {
          id: true,
          status: true,
          customer: { select: { id: true, name: true, phone: true } },
        },
      }),
      ctx.db.serviceReminder.findMany({
        where: {
          dueDate: { gte: todayStart, lt: tomorrowStart },
          status: "PENDING",
        },
        orderBy: { dueDate: "asc" },
        take: 50,
        select: {
          id: true,
          dueDate: true,
          status: true,
          workOrder: {
            select: {
              id: true,
              woNumber: true,
              reminderNextDate: true,
              customer: { select: { id: true, name: true, phone: true } },
              vehicle: { select: { id: true, plateNumber: true, brand: true, model: true } },
            },
          },
        },
      }),
    ]);

    const birthdays = birthdayPending.map((r) => ({
      reminderId: r.id,
      customerId: r.customer.id,
      name: r.customer.name,
      phone: r.customer.phone,
      status: r.status,
    }));

    const service = servicePending.map((r) => ({
      reminderId: r.id,
      workOrderId: r.workOrder.id,
      woNumber: r.workOrder.woNumber,
      reminderNextDate: r.workOrder.reminderNextDate,
      dueDate: r.dueDate,
      customer: r.workOrder.customer,
      vehicle: r.workOrder.vehicle,
      status: r.status,
    }));

    return {
      total: birthdays.length + service.length,
      birthdays,
      service,
    };
  }),

  followUpBirthdayReminder: adminProcedure
    .input(z.object({ reminderId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.birthdayReminder.update({
        where: { id: input.reminderId },
        data: {
          status: "FOLLOWED_UP",
          followedUpAt: new Date(),
          handledByUserId: ctx.session.user.id,
        },
      });
      return { ok: true };
    }),

  snoozeBirthdayReminder: adminProcedure
    .input(z.object({ reminderId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.birthdayReminder.update({
        where: { id: input.reminderId },
        data: {
          status: "SNOOZED",
          snoozedAt: new Date(),
          handledByUserId: ctx.session.user.id,
        },
      });
      return { ok: true };
    }),

  followUpServiceReminder: adminProcedure
    .input(z.object({ reminderId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.serviceReminder.update({
        where: { id: input.reminderId },
        data: {
          status: "FOLLOWED_UP",
          followedUpAt: new Date(),
          handledByUserId: ctx.session.user.id,
        },
      });
      return { ok: true };
    }),

  snoozeServiceReminder: adminProcedure
    .input(z.object({ reminderId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.serviceReminder.update({
        where: { id: input.reminderId },
        data: {
          status: "SNOOZED",
          snoozedAt: new Date(),
          handledByUserId: ctx.session.user.id,
        },
      });
      return { ok: true };
    }),

  listBirthdayReminders: adminProcedure
    .input(z.object({ take: z.number().int().min(1).max(200).default(100) }).optional())
    .query(async ({ ctx, input }) => {
      const take = input?.take ?? 100;
      const items = await ctx.db.birthdayReminder.findMany({
        orderBy: { reminderDate: "desc" },
        take,
        select: {
          id: true,
          reminderDate: true,
          status: true,
          followedUpAt: true,
          snoozedAt: true,
          handledByUser: { select: { id: true, name: true, email: true } },
          customer: { select: { id: true, name: true, phone: true } },
          createdAt: true,
        },
      });

      return { items };
    }),

  listServiceReminders: adminProcedure
    .input(z.object({ take: z.number().int().min(1).max(200).default(100) }).optional())
    .query(async ({ ctx, input }) => {
      const take = input?.take ?? 100;
      const items = await ctx.db.serviceReminder.findMany({
        orderBy: { dueDate: "desc" },
        take,
        select: {
          id: true,
          dueDate: true,
          status: true,
          followedUpAt: true,
          snoozedAt: true,
          handledByUser: { select: { id: true, name: true, email: true } },
          workOrder: {
            select: {
              id: true,
              woNumber: true,
              customer: { select: { id: true, name: true, phone: true } },
              vehicle: { select: { id: true, plateNumber: true, brand: true, model: true } },
            },
          },
          createdAt: true,
        },
      });

      return { items };
    }),

  getDashboardData: adminProcedure
    .input(z.object({ days: z.number().int().min(7).max(30).default(7) }).optional())
    .query(async ({ ctx, input }) => {
      const days = input?.days ?? 7;
      const now = new Date();
      const todayStart = startOfDay(now);
      const tomorrowStart = addDays(todayStart, 1);
      const rangeStart = addDays(todayStart, -(days - 1));

      const [
        customersCount,
        vehiclesCount,
        todayWorkOrdersCount,
        todayRevenueAgg,
        statusCounts,
        recent,
        rangeWos,
      ] = await Promise.all([
        ctx.db.customer.count(),
        ctx.db.vehicle.count(),
        ctx.db.workOrder.count({
          where: {
            createdAt: { gte: todayStart, lt: tomorrowStart },
          },
        }),
        ctx.db.workOrder.aggregate({
          where: {
            createdAt: { gte: todayStart, lt: tomorrowStart },
            status: { not: "CANCELLED" },
          },
          _sum: { grandTotal: true },
        }),
        ctx.db.workOrder.groupBy({
          by: ["status"],
          _count: { _all: true },
        }),
        ctx.db.workOrder.findMany({
          orderBy: { createdAt: "desc" },
          take: 8,
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
        ctx.db.workOrder.findMany({
          where: { createdAt: { gte: rangeStart, lt: tomorrowStart }, status: { not: "CANCELLED" } },
          select: { createdAt: true, grandTotal: true },
        }),
      ]);

      const countsByStatus = new Map<string, number>();
      for (const row of statusCounts) {
        countsByStatus.set(String(row.status), row._count._all);
      }

      const chart = Array.from({ length: days }).map((_, idx) => {
        const day = addDays(rangeStart, idx);
        return {
          date: day.toISOString().slice(0, 10),
          name: formatDayLabelId(day),
          services: 0,
          revenue: 0,
        };
      });
      const chartIndex = new Map(chart.map((c, i) => [c.date, i] as const));
      for (const wo of rangeWos) {
        const dateKey = startOfDay(new Date(wo.createdAt)).toISOString().slice(0, 10);
        const i = chartIndex.get(dateKey);
        if (i == null) continue;
        chart[i]!.services += 1;
        chart[i]!.revenue += wo.grandTotal ?? 0;
      }

      return {
        counts: {
          customers: customersCount,
          vehicles: vehiclesCount,
        },
        today: {
          workOrders: todayWorkOrdersCount,
          revenue: todayRevenueAgg._sum.grandTotal ?? 0,
        },
        status: {
          draft: countsByStatus.get("DRAFT") ?? 0,
          antrian: countsByStatus.get("ANTRIAN") ?? 0,
          proses: countsByStatus.get("PROSES") ?? 0,
          selesai: countsByStatus.get("SELESAI") ?? 0,
          diambil: countsByStatus.get("DIAMBIL") ?? 0,
        },
        recent,
        chart,
      };
    }),

  createServiceExample: permissionProcedure("create_service")
    .input(
      z.object({
        vehiclePlate: z.string().min(1),
      }),
    )
    .mutation(({ input }) => {
      return {
        ok: true,
        message: `Service created for ${input.vehiclePlate}`,
      };
    }),
});

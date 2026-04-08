import { z } from "zod";

import {
  adminProcedure,
  createTRPCRouter,
  permissionProcedure,
} from "~/server/api/trpc";

export const adminRouter = createTRPCRouter({
  getAdminSummary: adminProcedure.query(({ ctx }) => {
    return {
      userId: ctx.session.user.id,
      role: ctx.session.user.role.name,
      permissions: ctx.session.user.permissions,
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

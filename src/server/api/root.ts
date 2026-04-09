import { adminRouter } from "~/server/api/routers/admin";
import { rbacRouter } from "~/server/api/routers/rbac";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  admin: adminRouter,
  rbac: rbacRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.admin.getAdminSummary();
 *       ^? { userId: string; role: string; permissions: string[] }
 */
export const createCaller = createCallerFactory(appRouter);

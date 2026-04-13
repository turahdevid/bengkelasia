import { type NextAuthConfig } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { db } from "~/server/db";

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const authConfig = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = z
          .object({
            email: z.string().email(),
            password: z.string().min(1),
          })
          .safeParse(credentials);

        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const user = await db.user.findUnique({
          where: { email },
          select: {
            id: true,
            name: true,
            email: true,
            password: true,
            role: {
              select: {
                id: true,
                name: true,
                rolePermissions: {
                  select: {
                    permission: { select: { name: true } },
                  },
                },
              },
            },
          },
        });

        if (!user) return null;

        const ok = await bcrypt.compare(password, user.password);
        if (!ok) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          permissions: user.role.rolePermissions.map((rp) => rp.permission.name),
        };
      },
    }),
    /**
     * ...add more providers here.
     *
     * Most other providers require a bit more work than the Discord provider. For example, the
     * GitHub provider requires you to add the `refresh_token_expires_in` field to the Account
     * model. Refer to the NextAuth.js docs for the provider you want to use. Example:
     *
     * @see https://next-auth.js.org/providers/github
     */
  ],
  session: { strategy: "jwt" },
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        const hasRole =
          typeof user === "object" &&
          user !== null &&
          "role" in user &&
          typeof (user as { role?: unknown }).role === "object" &&
          (user as { role?: unknown }).role !== null;

        const role = hasRole
          ? (user as { role: { id: string; name: string } }).role
          : undefined;

        const permissions =
          typeof user === "object" &&
          user !== null &&
          "permissions" in user &&
          Array.isArray((user as { permissions?: unknown }).permissions)
            ? (user as { permissions: unknown[] }).permissions.filter(
                (p): p is string => typeof p === "string",
              )
            : [];

        token.role = role;
        token.permissions = permissions;
      }
      return token;
    },
    session: ({ session, token }) => ({
      ...session,
      user: {
        ...session.user,
        id: token.sub!,
        role: token.role!,
        permissions: token.permissions ?? [],
      },
    }),
  },
} satisfies NextAuthConfig;

import { redirect } from "next/navigation";

import { auth } from "~/server/auth";

import AdminShell from "./admin-shell";

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();

  if (!session?.user) {
    redirect("/");
  }

  return <AdminShell>{children}</AdminShell>;
}

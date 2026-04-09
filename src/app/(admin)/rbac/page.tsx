"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";

const roleFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nama role minimal 2 karakter")
    .max(50, "Nama role maksimal 50 karakter")
    .regex(/^[a-z0-9_\-\s]+$/i, "Nama role hanya boleh huruf/angka/spasi/_/-"),
});

type RoleFormValues = z.infer<typeof roleFormSchema>;

const permissionFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nama permission minimal 2 karakter")
    .max(80, "Nama permission maksimal 80 karakter")
    .regex(/^[a-z0-9_\-\.]+$/i, "Gunakan format seperti: create_service, read.user, dll"),
});

type PermissionFormValues = z.infer<typeof permissionFormSchema>;

export default function RbacPage() {
  const utils = api.useUtils();

  const [selectedRoleId, setSelectedRoleId] = React.useState<string | null>(null);
  const [mode, setMode] = React.useState<"create" | "edit">("create");
  const [roleError, setRoleError] = React.useState<string | null>(null);
  const [permError, setPermError] = React.useState<string | null>(null);

  const rolesQuery = api.rbac.listRoles.useQuery(undefined, {
    retry: false,
  });
  const permissionsQuery = api.rbac.listPermissions.useQuery(undefined, {
    retry: false,
  });

  const rolePermissionsQuery = api.rbac.getRolePermissions.useQuery(
    { roleId: selectedRoleId ?? "" },
    {
      enabled: !!selectedRoleId,
      retry: false,
    },
  );

  const createRole = api.rbac.createRole.useMutation({
    onSuccess: async (role) => {
      await utils.rbac.listRoles.invalidate();
      setSelectedRoleId(role.id);
      setMode("edit");
      setRoleError(null);
    },
    onError: (e) => setRoleError(e.message),
  });

  const updateRole = api.rbac.updateRole.useMutation({
    onSuccess: async () => {
      await utils.rbac.listRoles.invalidate();
      setRoleError(null);
    },
    onError: (e) => setRoleError(e.message),
  });

  const deleteRole = api.rbac.deleteRole.useMutation({
    onSuccess: async () => {
      await utils.rbac.listRoles.invalidate();
      setSelectedRoleId(null);
      setMode("create");
      roleForm.reset({ name: "" });
      setRoleError(null);
    },
    onError: (e) => setRoleError(e.message),
  });

  const createPermission = api.rbac.createPermission.useMutation({
    onSuccess: async () => {
      await utils.rbac.listPermissions.invalidate();
      setPermError(null);
      permissionForm.reset({ name: "" });
    },
    onError: (e) => setPermError(e.message),
  });

  const deletePermission = api.rbac.deletePermission.useMutation({
    onSuccess: async () => {
      await utils.rbac.listPermissions.invalidate();
      if (selectedRoleId) {
        await utils.rbac.getRolePermissions.invalidate({ roleId: selectedRoleId });
      }
      setPermError(null);
    },
    onError: (e) => setPermError(e.message),
  });

  const setRolePermissions = api.rbac.setRolePermissions.useMutation({
    onSuccess: async () => {
      if (selectedRoleId) {
        await utils.rbac.getRolePermissions.invalidate({ roleId: selectedRoleId });
      }
    },
  });

  const roleForm = useForm<RoleFormValues>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: { name: "" },
  });

  const permissionForm = useForm<PermissionFormValues>({
    resolver: zodResolver(permissionFormSchema),
    defaultValues: { name: "" },
  });

  const selectedRole = React.useMemo(() => {
    const roles = rolesQuery.data ?? [];
    return roles.find((r) => r.id === selectedRoleId) ?? null;
  }, [rolesQuery.data, selectedRoleId]);

  React.useEffect(() => {
    if (!rolesQuery.data) return;

    if (!selectedRoleId && rolesQuery.data.length > 0) {
      setSelectedRoleId(rolesQuery.data[0]!.id);
      setMode("edit");
    }
  }, [rolesQuery.data, selectedRoleId]);

  React.useEffect(() => {
    if (!selectedRole) return;
    if (mode !== "edit") return;

    roleForm.reset({ name: selectedRole.name });
  }, [selectedRole, mode, roleForm]);
  const [localPermissionIds, setLocalPermissionIds] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (!selectedRoleId) {
      setLocalPermissionIds([]);
      return;
    }
    if (!rolePermissionsQuery.data) return;
    setLocalPermissionIds(rolePermissionsQuery.data.permissionIds);
  }, [selectedRoleId, rolePermissionsQuery.data]);

  const isForbidden =
    rolesQuery.error?.data?.code === "FORBIDDEN" ||
    permissionsQuery.error?.data?.code === "FORBIDDEN";

  if (isForbidden) {
    return (
      <div className="rounded-3xl border border-slate-200/70 bg-white/60 p-6 shadow-sm backdrop-blur-lg">
        <h1 className="text-lg font-semibold text-slate-900">Manajemen Akses</h1>
        <p className="mt-2 text-sm text-slate-600">
          Kamu tidak punya akses untuk membuka halaman ini.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <Card className="border-slate-200/70 bg-white/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Role</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Button
              variant={mode === "create" ? "default" : "secondary"}
              className="h-10"
              onClick={() => {
                setMode("create");
                setSelectedRoleId(null);
                setRoleError(null);
                roleForm.reset({ name: "" });
              }}
            >
              Tambah Role
            </Button>
            <Button
              variant={mode === "edit" ? "default" : "secondary"}
              className="h-10"
              onClick={() => {
                if (!selectedRoleId) return;
                setMode("edit");
                setRoleError(null);
              }}
              disabled={!selectedRoleId}
            >
              Edit
            </Button>
          </div>

          {roleError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {roleError}
            </div>
          ) : null}

          <div className="max-h-[360px] overflow-auto pr-1">
            <div className="space-y-2">
              {(rolesQuery.data ?? []).map((r) => {
                const active = r.id === selectedRoleId;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      setSelectedRoleId(r.id);
                      setMode("edit");
                      setRoleError(null);
                    }}
                    className={cn(
                      "w-full rounded-2xl border px-3 py-2 text-left transition-all",
                      active
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white/40 text-slate-800 hover:bg-white/70",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold">{r.name}</div>
                      <div
                        className={cn(
                          "text-xs",
                          active ? "text-white/80" : "text-slate-500",
                        )}
                      >
                        {r._count.users} user
                      </div>
                    </div>
                    <div
                      className={cn(
                        "mt-1 text-xs",
                        active ? "text-white/80" : "text-slate-500",
                      )}
                    >
                      {r._count.rolePermissions} permission
                    </div>
                  </button>
                );
              })}

              {rolesQuery.isLoading ? (
                <div className="text-sm text-slate-500">Memuat role...</div>
              ) : null}
            </div>
          </div>

          <form
            onSubmit={roleForm.handleSubmit(async (values) => {
              setRoleError(null);

              if (mode === "create") {
                await createRole.mutateAsync(values);
                return;
              }

              if (!selectedRoleId) {
                setRoleError("Pilih role dulu");
                return;
              }

              await updateRole.mutateAsync({ id: selectedRoleId, name: values.name });
            })}
            className="space-y-2"
          >
            <div>
              <label className="text-xs font-semibold text-slate-700">Nama Role</label>
              <Input
                className="mt-1"
                placeholder="Contoh: kasir"
                {...roleForm.register("name")}
              />
              {roleForm.formState.errors.name?.message ? (
                <p className="mt-1 text-xs text-red-600">
                  {roleForm.formState.errors.name.message}
                </p>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="submit"
                className="h-10"
                disabled={createRole.isPending || updateRole.isPending}
              >
                {mode === "create" ? "Buat Role" : "Simpan"}
              </Button>
              <Button
                variant="secondary"
                className="h-10"
                disabled={!selectedRoleId || deleteRole.isPending}
                onClick={async () => {
                  if (!selectedRoleId) return;
                  const ok = window.confirm("Hapus role ini?");
                  if (!ok) return;
                  setRoleError(null);
                  await deleteRole.mutateAsync({ id: selectedRoleId });
                }}
              >
                Hapus
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-slate-200/70 bg-white/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Permission</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white/40 p-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  Alur penggunaan
                </div>
                <div className="text-xs text-slate-600">
                  1) Pilih role di kiri. 2) Centang permission. 3) Klik Simpan Akses.
                </div>
              </div>
            </div>
          </div>

          <form
            onSubmit={permissionForm.handleSubmit(async (values) => {
              setPermError(null);
              await createPermission.mutateAsync(values);
            })}
            className="flex flex-col gap-2 sm:flex-row sm:items-end"
          >
            <div className="w-full">
              <label className="text-xs font-semibold text-slate-700">
                Tambah Permission
              </label>
              <Input
                className="mt-1"
                placeholder="contoh: create_service"
                {...permissionForm.register("name")}
              />
              {permissionForm.formState.errors.name?.message ? (
                <p className="mt-1 text-xs text-red-600">
                  {permissionForm.formState.errors.name.message}
                </p>
              ) : null}
            </div>
            <Button
              type="submit"
              className="h-10"
              disabled={createPermission.isPending}
            >
              Tambah
            </Button>
          </form>

          {permError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {permError}
            </div>
          ) : null}

          <div className="rounded-2xl border border-slate-200 bg-white/40">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div className="text-sm font-semibold text-slate-900">
                Akses untuk role: {selectedRole?.name ?? "(pilih role)"}
              </div>
              <Button
                className="h-10"
                disabled={!selectedRoleId || setRolePermissions.isPending}
                onClick={async () => {
                  if (!selectedRoleId) return;
                  await setRolePermissions.mutateAsync({
                    roleId: selectedRoleId,
                    permissionIds: localPermissionIds,
                  });
                }}
              >
                Simpan Akses
              </Button>
            </div>

            <div className="max-h-[420px] overflow-auto p-2">
              {permissionsQuery.isLoading ? (
                <div className="p-2 text-sm text-slate-500">Memuat permission...</div>
              ) : null}

              {(permissionsQuery.data ?? []).map((p) => {
                const checked = localPermissionIds.includes(p.id);
                const disabled = !selectedRoleId;
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 hover:bg-white/60"
                  >
                    <label className="flex cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-slate-900"
                        disabled={disabled}
                        checked={checked}
                        onChange={(e) => {
                          if (!selectedRoleId) return;
                          const next = e.target.checked
                            ? Array.from(new Set([...localPermissionIds, p.id]))
                            : localPermissionIds.filter((id) => id !== p.id);
                          setLocalPermissionIds(next);
                        }}
                      />
                      <span className="text-sm font-medium text-slate-800">
                        {p.name}
                      </span>
                    </label>

                    <Button
                      variant="secondary"
                      className="h-9"
                      disabled={deletePermission.isPending}
                      onClick={async () => {
                        const ok = window.confirm(
                          `Hapus permission '${p.name}'? (akan menghapus relasi dari semua role)`,
                        );
                        if (!ok) return;
                        setPermError(null);
                        await deletePermission.mutateAsync({ id: p.id });
                      }}
                    >
                      Hapus
                    </Button>
                  </div>
                );
              })}
            </div>

            {selectedRoleId && rolePermissionsQuery.isLoading ? (
              <div className="border-t border-slate-200 p-3 text-xs text-slate-500">
                Memuat akses role...
              </div>
            ) : null}

            {selectedRoleId && rolePermissionsQuery.error ? (
              <div className="border-t border-slate-200 p-3 text-xs text-red-600">
                {rolePermissionsQuery.error.message}
              </div>
            ) : null}
          </div>

          <div className="text-xs text-slate-600">
            Catatan: perubahan akses akan efektif untuk user pada role ini setelah session user
            diperbarui (misal logout/login).
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

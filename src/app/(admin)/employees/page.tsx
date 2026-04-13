"use client";

import * as React from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Pencil, Plus } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Textarea } from "~/components/ui/textarea";
import { useDebouncedValue } from "~/hooks/use-debounced-value";
import { useToast } from "~/hooks/use-toast";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

type CreateFlow = "withUser" | "existingUser";

const createEmployeeFormSchema = z.object({
  userId: z.string().min(1, "User wajib dipilih"),
  position: z.string().trim().min(2, "Posisi minimal 2 karakter").max(60),
  phone: z.string().trim().max(500).optional(),
  address: z.string().trim().max(500).optional(),
  joinDate: z
    .string()
    .trim()
    .optional()
    .refine(
      (v) => {
        if (!v) return true;
        const d = new Date(v);
        return !Number.isNaN(d.getTime());
      },
      { message: "Tanggal masuk tidak valid" },
    ),
  isActive: z.boolean(),
});

type CreateEmployeeFormValues = z.infer<typeof createEmployeeFormSchema>;

const createEmployeeWithUserFormSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter").max(120),
  email: z.string().trim().email("Email tidak valid").max(190),
  password: z.string().min(8, "Password minimal 8 karakter").max(190),
  roleId: z.string().min(1, "Role wajib dipilih"),
  position: z.string().trim().min(2, "Posisi minimal 2 karakter").max(60),
  phone: z.string().trim().max(500).optional(),
  address: z.string().trim().max(500).optional(),
  joinDate: z
    .string()
    .trim()
    .optional()
    .refine(
      (v) => {
        if (!v) return true;
        const d = new Date(v);
        return !Number.isNaN(d.getTime());
      },
      { message: "Tanggal masuk tidak valid" },
    ),
  isActive: z.boolean(),
});

type CreateEmployeeWithUserFormValues = z.infer<typeof createEmployeeWithUserFormSchema>;

const updateEmployeeFormSchema = z.object({
  position: z.string().trim().min(2, "Posisi minimal 2 karakter").max(60),
  phone: z.string().trim().max(500).optional(),
  address: z.string().trim().max(500).optional(),
  joinDate: z
    .string()
    .trim()
    .optional()
    .refine(
      (v) => {
        if (!v) return true;
        const d = new Date(v);
        return !Number.isNaN(d.getTime());
      },
      { message: "Tanggal masuk tidak valid" },
    ),
  isActive: z.boolean(),
});

type UpdateEmployeeFormValues = z.infer<typeof updateEmployeeFormSchema>;

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function EmployeesPage() {
  const utils = api.useUtils();
  const { toast } = useToast();

  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebouncedValue(search, 400);

  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState<10 | 20 | 50>(10);

  const [employeeModalOpen, setEmployeeModalOpen] = React.useState(false);
  const [mode, setMode] = React.useState<"create" | "edit">("create");
  const [editEmployeeId, setEditEmployeeId] = React.useState<string | null>(null);

  const [createFlow, setCreateFlow] = React.useState<CreateFlow>("withUser");

  const [userSearch, setUserSearch] = React.useState("");
  const debouncedUserSearch = useDebouncedValue(userSearch, 300);

  const listQuery = api.employee.list.useQuery(
    {
      page,
      limit,
      query: debouncedSearch ? debouncedSearch : undefined,
    },
    { retry: false },
  );

  const editQuery = api.employee.getById.useQuery(
    { id: editEmployeeId ?? "" },
    {
      enabled: employeeModalOpen && mode === "edit" && !!editEmployeeId,
      retry: false,
    },
  );

  const rolesQuery = api.employee.listRoles.useQuery(undefined, {
    enabled: employeeModalOpen && mode === "create" && createFlow === "withUser",
    retry: false,
  });

  const availableUsersQuery = api.employee.listAvailableUsers.useQuery(
    { query: debouncedUserSearch ? debouncedUserSearch : undefined },
    {
      enabled: employeeModalOpen && mode === "create" && createFlow === "existingUser",
      retry: false,
    },
  );

  React.useEffect(() => {
    setPage(1);
  }, [debouncedSearch, limit]);

  const createEmployee = api.employee.create.useMutation({
    onSuccess: async () => {
      await utils.employee.list.invalidate();
      toast({ variant: "success", title: "Pegawai berhasil dibuat" });
      setEmployeeModalOpen(false);
    },
    onError: (e) =>
      toast({ variant: "destructive", title: "Gagal membuat pegawai", description: e.message }),
  });

  const createEmployeeWithUser = api.employee.createWithUser.useMutation({
    onSuccess: async () => {
      await utils.employee.list.invalidate();
      toast({ variant: "success", title: "Pegawai berhasil dibuat" });
      setEmployeeModalOpen(false);
    },
    onError: (e) =>
      toast({ variant: "destructive", title: "Gagal membuat pegawai", description: e.message }),
  });

  const updateEmployee = api.employee.update.useMutation({
    onSuccess: async () => {
      await utils.employee.list.invalidate();
      toast({ variant: "success", title: "Pegawai berhasil diupdate" });
      setEmployeeModalOpen(false);
    },
    onError: (e) =>
      toast({ variant: "destructive", title: "Gagal update pegawai", description: e.message }),
  });

  const createForm = useForm<CreateEmployeeFormValues>({
    resolver: zodResolver(createEmployeeFormSchema),
    defaultValues: {
      userId: "",
      position: "",
      phone: "",
      address: "",
      joinDate: "",
      isActive: true,
    },
  });

  const createWithUserForm = useForm<CreateEmployeeWithUserFormValues>({
    resolver: zodResolver(createEmployeeWithUserFormSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      roleId: "",
      position: "",
      phone: "",
      address: "",
      joinDate: "",
      isActive: true,
    },
  });

  const updateForm = useForm<UpdateEmployeeFormValues>({
    resolver: zodResolver(updateEmployeeFormSchema),
    defaultValues: {
      position: "",
      phone: "",
      address: "",
      joinDate: "",
      isActive: true,
    },
  });

  React.useEffect(() => {
    if (!employeeModalOpen) return;

    if (mode === "create") {
      setCreateFlow("withUser");
      setUserSearch("");
      createForm.reset({
        userId: "",
        position: "",
        phone: "",
        address: "",
        joinDate: "",
        isActive: true,
      });

      createWithUserForm.reset({
        name: "",
        email: "",
        password: "",
        roleId: "",
        position: "",
        phone: "",
        address: "",
        joinDate: "",
        isActive: true,
      });
      return;
    }

    const data = editQuery.data;
    if (!data) return;

    updateForm.reset({
      position: data.position,
      phone: data.phone ?? "",
      address: data.address ?? "",
      joinDate: data.joinDate ? toDateInputValue(new Date(data.joinDate)) : "",
      isActive: data.isActive,
    });
  }, [createForm, createWithUserForm, editQuery.data, employeeModalOpen, mode, updateForm]);

  const onSubmitCreate = createForm.handleSubmit(async (values) => {
    await createEmployee.mutateAsync({
      userId: values.userId,
      position: values.position,
      phone: values.phone?.trim() ? values.phone.trim() : undefined,
      address: values.address?.trim() ? values.address.trim() : undefined,
      joinDate: values.joinDate?.trim() ? values.joinDate.trim() : undefined,
      isActive: values.isActive,
    });
  });

  const onSubmitCreateWithUser = createWithUserForm.handleSubmit(async (values) => {
    await createEmployeeWithUser.mutateAsync({
      user: {
        name: values.name,
        email: values.email,
        password: values.password,
        roleId: values.roleId,
      },
      employee: {
        position: values.position,
        phone: values.phone?.trim() ? values.phone.trim() : undefined,
        address: values.address?.trim() ? values.address.trim() : undefined,
        joinDate: values.joinDate?.trim() ? values.joinDate.trim() : undefined,
        isActive: values.isActive,
      },
    });
  });

  const onSubmitUpdate = updateForm.handleSubmit(async (values) => {
    if (!editEmployeeId) return;

    await updateEmployee.mutateAsync({
      id: editEmployeeId,
      position: values.position,
      phone: values.phone?.trim() ? values.phone.trim() : undefined,
      address: values.address?.trim() ? values.address.trim() : undefined,
      joinDate: values.joinDate?.trim() ? values.joinDate.trim() : undefined,
      isActive: values.isActive,
    });
  });

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <Card className="border border-slate-200/70 bg-white/60 shadow-sm backdrop-blur-lg">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-slate-900">Pegawai</CardTitle>
          <p className="mt-1 text-sm text-slate-600">Kelola data pegawai bengkel.</p>
        </div>

        <Button
          onClick={() => {
            setMode("create");
            setEditEmployeeId(null);
            setEmployeeModalOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Tambah Pegawai
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-full sm:max-w-md">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama, email, atau posisi"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-700">Limit</span>
            <select
              className={cn(
                "h-11 rounded-xl border border-white/20 bg-white/40 px-3 text-sm text-slate-900 shadow-sm backdrop-blur-md",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200",
              )}
              value={limit}
              onChange={(e) => {
                const next = Number(e.target.value);
                if (next === 10 || next === 20 || next === 50) setLimit(next);
              }}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white/40 shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {listQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <div className="py-8 text-center text-sm text-slate-600">Loading...</div>
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <div className="py-10 text-center">
                      <p className="text-sm font-semibold text-slate-900">Pegawai belum ada</p>
                      <p className="mt-1 text-sm text-slate-600">
                        Klik tombol Tambah Pegawai untuk membuat data baru.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                items.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-semibold">{e.user.name ?? "-"}</TableCell>
                    <TableCell>{e.position}</TableCell>
                    <TableCell>{e.phone ?? "-"}</TableCell>
                    <TableCell>
                      {e.isActive ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                          Active
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                          Inactive
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Edit"
                        onClick={() => {
                          setMode("edit");
                          setEditEmployeeId(e.id);
                          setEmployeeModalOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-700">
            Page {page} dari {totalPages} (Total: {total})
          </p>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              disabled={page <= 1 || listQuery.isFetching}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </Button>
            <Button
              variant="secondary"
              disabled={page >= totalPages || listQuery.isFetching}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      </CardContent>

      <Dialog open={employeeModalOpen} onOpenChange={setEmployeeModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "Tambah Pegawai" : "Edit Pegawai"}</DialogTitle>
            <DialogDescription>
              Pegawai adalah data tambahan untuk User. Tidak menyimpan email atau password.
            </DialogDescription>
          </DialogHeader>

          {mode === "edit" && editQuery.isLoading ? (
            <div className="px-6 pb-6 pt-4 text-sm text-slate-600">Loading...</div>
          ) : (
            <form
              className="px-6 pb-2 pt-4"
              onSubmit={
                mode === "create"
                  ? createFlow === "withUser"
                    ? onSubmitCreateWithUser
                    : onSubmitCreate
                  : onSubmitUpdate
              }
            >
              <div className="grid gap-3">
                {mode === "create" ? (
                  <>
                    <div className="grid gap-2">
                      <label className="text-sm font-semibold text-slate-700">Tipe</label>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant={createFlow === "withUser" ? "default" : "secondary"}
                          className="h-10"
                          onClick={() => setCreateFlow("withUser")}
                        >
                          Buat User Baru
                        </Button>
                        <Button
                          type="button"
                          variant={createFlow === "existingUser" ? "default" : "secondary"}
                          className="h-10"
                          onClick={() => setCreateFlow("existingUser")}
                        >
                          Pilih User
                        </Button>
                      </div>
                    </div>

                    {createFlow === "withUser" ? (
                      <>
                        <div className="grid gap-1">
                          <label className="text-sm font-semibold text-slate-700" htmlFor="name">
                            Nama
                          </label>
                          <Input id="name" {...createWithUserForm.register("name")} />
                          {createWithUserForm.formState.errors.name ? (
                            <p className="text-sm text-red-600">
                              {createWithUserForm.formState.errors.name.message}
                            </p>
                          ) : null}
                        </div>

                        <div className="grid gap-1">
                          <label className="text-sm font-semibold text-slate-700" htmlFor="email">
                            Email
                          </label>
                          <Input id="email" type="email" {...createWithUserForm.register("email")} />
                          {createWithUserForm.formState.errors.email ? (
                            <p className="text-sm text-red-600">
                              {createWithUserForm.formState.errors.email.message}
                            </p>
                          ) : null}
                        </div>

                        <div className="grid gap-1">
                          <label className="text-sm font-semibold text-slate-700" htmlFor="password">
                            Password
                          </label>
                          <Input
                            id="password"
                            type="password"
                            autoComplete="new-password"
                            {...createWithUserForm.register("password")}
                          />
                          {createWithUserForm.formState.errors.password ? (
                            <p className="text-sm text-red-600">
                              {createWithUserForm.formState.errors.password.message}
                            </p>
                          ) : null}
                        </div>

                        <div className="grid gap-2">
                          <label className="text-sm font-semibold text-slate-700" htmlFor="role">
                            Role
                          </label>
                          <select
                            id="role"
                            className={cn(
                              "h-11 rounded-xl border border-white/20 bg-white/40 px-3 text-sm text-slate-900 shadow-sm backdrop-blur-md",
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200",
                            )}
                            value={createWithUserForm.watch("roleId")}
                            onChange={(e) => createWithUserForm.setValue("roleId", e.target.value)}
                          >
                            <option value="">Pilih Role</option>
                            {(rolesQuery.data ?? []).map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name}
                              </option>
                            ))}
                          </select>
                          {createWithUserForm.formState.errors.roleId ? (
                            <p className="text-sm text-red-600">
                              {createWithUserForm.formState.errors.roleId.message}
                            </p>
                          ) : null}
                        </div>
                      </>
                    ) : (
                      <div className="grid gap-2">
                        <label className="text-sm font-semibold text-slate-700" htmlFor="user">
                          User
                        </label>
                        <Input
                          value={userSearch}
                          onChange={(e) => setUserSearch(e.target.value)}
                          placeholder="Cari user (nama atau email)"
                        />
                        <select
                          id="user"
                          className={cn(
                            "h-11 rounded-xl border border-white/20 bg-white/40 px-3 text-sm text-slate-900 shadow-sm backdrop-blur-md",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200",
                          )}
                          value={createForm.watch("userId")}
                          onChange={(e) => createForm.setValue("userId", e.target.value)}
                        >
                          <option value="">Pilih User</option>
                          {(availableUsersQuery.data ?? []).map((u) => (
                            <option key={u.id} value={u.id}>
                              {(u.name ?? "-") + " - " + u.email}
                            </option>
                          ))}
                        </select>
                        {createForm.formState.errors.userId ? (
                          <p className="text-sm text-red-600">
                            {createForm.formState.errors.userId.message}
                          </p>
                        ) : null}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="rounded-2xl border border-slate-200/70 bg-white/40 px-3 py-2 text-sm text-slate-700">
                    <p className="font-semibold text-slate-900">
                      {editQuery.data?.user.name ?? "-"}
                    </p>
                    <p>{editQuery.data?.user.email ?? "-"}</p>
                  </div>
                )}

                <div className="grid gap-1">
                  <label className="text-sm font-semibold text-slate-700" htmlFor="position">
                    Position
                  </label>
                  <Input
                    id="position"
                    {...(mode === "create"
                      ? createFlow === "withUser"
                        ? createWithUserForm.register("position")
                        : createForm.register("position")
                      : updateForm.register("position"))}
                  />
                  {mode === "create" && createFlow === "existingUser" && createForm.formState.errors.position ? (
                    <p className="text-sm text-red-600">
                      {createForm.formState.errors.position.message}
                    </p>
                  ) : null}
                  {mode === "create" && createFlow === "withUser" && createWithUserForm.formState.errors.position ? (
                    <p className="text-sm text-red-600">
                      {createWithUserForm.formState.errors.position.message}
                    </p>
                  ) : null}
                  {mode === "edit" && updateForm.formState.errors.position ? (
                    <p className="text-sm text-red-600">
                      {updateForm.formState.errors.position.message}
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-1">
                  <label className="text-sm font-semibold text-slate-700" htmlFor="phone">
                    Phone
                  </label>
                  <Input
                    id="phone"
                    {...(mode === "create"
                      ? createFlow === "withUser"
                        ? createWithUserForm.register("phone")
                        : createForm.register("phone")
                      : updateForm.register("phone"))}
                  />
                </div>

                <div className="grid gap-1">
                  <label className="text-sm font-semibold text-slate-700" htmlFor="address">
                    Address
                  </label>
                  <Textarea
                    id="address"
                    {...(mode === "create"
                      ? createFlow === "withUser"
                        ? createWithUserForm.register("address")
                        : createForm.register("address")
                      : updateForm.register("address"))}
                  />
                </div>

                <div className="grid gap-1">
                  <label className="text-sm font-semibold text-slate-700" htmlFor="joinDate">
                    Join Date
                  </label>
                  <Input
                    id="joinDate"
                    type="date"
                    {...(mode === "create"
                      ? createFlow === "withUser"
                        ? createWithUserForm.register("joinDate")
                        : createForm.register("joinDate")
                      : updateForm.register("joinDate"))}
                  />
                </div>

                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={
                      mode === "create"
                        ? createFlow === "withUser"
                          ? createWithUserForm.watch("isActive")
                          : createForm.watch("isActive")
                        : updateForm.watch("isActive")
                    }
                    onChange={(e) => {
                      if (mode === "create") {
                        if (createFlow === "withUser") {
                          createWithUserForm.setValue("isActive", e.target.checked);
                          return;
                        }
                        createForm.setValue("isActive", e.target.checked);
                        return;
                      }
                      updateForm.setValue("isActive", e.target.checked);
                    }}
                  />
                  Active
                </label>
              </div>

              <DialogFooter className="px-0 pb-2 pt-6">
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => {
                    setEmployeeModalOpen(false);
                    setEditEmployeeId(null);
                  }}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={
                    createEmployee.isPending ||
                    createEmployeeWithUser.isPending ||
                    updateEmployee.isPending
                  }
                >
                  {createEmployee.isPending ||
                  createEmployeeWithUser.isPending ||
                  updateEmployee.isPending
                    ? "Menyimpan..."
                    : "Simpan"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

"use client";

import Link from "next/link";
import * as React from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { CarFront, Pencil, Plus, Trash2 } from "lucide-react";

import { buttonVariants, Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
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

const customerFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nama minimal 2 karakter")
    .max(120, "Nama maksimal 120 karakter"),
  phone: z
    .string()
    .trim()
    .min(6, "Nomor telepon tidak valid")
    .max(30, "Nomor telepon terlalu panjang"),
  address: z.string().trim().max(500).optional(),
  birthDate: z
    .string()
    .trim()
    .optional()
    .refine(
      (v) => {
        if (!v) return true;
        const d = new Date(v);
        return !Number.isNaN(d.getTime());
      },
      { message: "Tanggal lahir tidak valid" },
    ),
  note: z.string().trim().max(500).optional(),
});

type CustomerFormValues = z.infer<typeof customerFormSchema>;

type EditCustomer = {
  id: string;
  name: string;
  phone: string;
  address: string | null;
  birthDate: Date | null;
  note: string | null;
};

function formatDateShort(d: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function CustomerListPage() {
  const utils = api.useUtils();
  const { toast } = useToast();

  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebouncedValue(search, 400);

  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState<10 | 20 | 50>(10);

  const [customerModalOpen, setCustomerModalOpen] = React.useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = React.useState(false);
  const [mode, setMode] = React.useState<"create" | "edit">("create");
  const [editCustomerId, setEditCustomerId] = React.useState<string | null>(null);
  const [editCustomer, setEditCustomer] = React.useState<EditCustomer | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = React.useState<{
    id: string;
    name: string;
  } | null>(null);

  const listQuery = api.customer.list.useQuery(
    {
      page,
      limit,
      query: debouncedSearch ? debouncedSearch : undefined,
    },
    {
      retry: false,
    },
  );

  const editQuery = api.customer.getById.useQuery(
    { id: editCustomerId ?? "" },
    {
      enabled: customerModalOpen && mode === "edit" && !!editCustomerId,
      retry: false,
    },
  );

  React.useEffect(() => {
    setPage(1);
  }, [debouncedSearch, limit]);

  const createCustomer = api.customer.create.useMutation({
    onSuccess: async () => {
      await utils.customer.list.invalidate();
      toast({ variant: "success", title: "Customer berhasil dibuat" });
      setCustomerModalOpen(false);
    },
    onError: (e) =>
      toast({ variant: "destructive", title: "Gagal membuat customer", description: e.message }),
  });

  const updateCustomer = api.customer.update.useMutation({
    onSuccess: async () => {
      await utils.customer.list.invalidate();
      toast({ variant: "success", title: "Customer berhasil diupdate" });
      setCustomerModalOpen(false);
    },
    onError: (e) =>
      toast({ variant: "destructive", title: "Gagal update customer", description: e.message }),
  });

  const deleteCustomer = api.customer.delete.useMutation({
    onSuccess: async () => {
      await utils.customer.list.invalidate();
      toast({ variant: "success", title: "Customer berhasil dihapus" });
      setDeleteModalOpen(false);
      setDeleteTarget(null);
    },
    onError: (e) =>
      toast({ variant: "destructive", title: "Gagal hapus customer", description: e.message }),
  });

  const customerForm = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      name: "",
      phone: "",
      address: "",
      birthDate: "",
      note: "",
    },
  });

  React.useEffect(() => {
    if (!customerModalOpen) return;
    if (mode !== "edit") return;
    if (!editQuery.data) return;

    setEditCustomer({
      id: editQuery.data.id,
      name: editQuery.data.name,
      phone: editQuery.data.phone,
      address: editQuery.data.address,
      birthDate: editQuery.data.birthDate ? new Date(editQuery.data.birthDate) : null,
      note: editQuery.data.note,
    });

    customerForm.reset({
      name: editQuery.data.name,
      phone: editQuery.data.phone,
      address: editQuery.data.address ?? "",
      birthDate: editQuery.data.birthDate
        ? toDateInputValue(new Date(editQuery.data.birthDate))
        : "",
      note: editQuery.data.note ?? "",
    });
  }, [customerForm, customerModalOpen, editQuery.data, mode]);

  React.useEffect(() => {
    if (!customerModalOpen) return;

    if (mode === "create") {
      customerForm.reset({
        name: "",
        phone: "",
        address: "",
        birthDate: "",
        note: "",
      });
      return;
    }

    void editCustomer;
  }, [customerForm, customerModalOpen, editCustomer, mode]);

  const onSubmitCustomer = customerForm.handleSubmit(async (values) => {
    const payload = {
      name: values.name,
      phone: values.phone,
      address: values.address?.trim() ? values.address.trim() : undefined,
      birthDate: values.birthDate?.trim() ? values.birthDate.trim() : undefined,
      note: values.note?.trim() ? values.note.trim() : undefined,
    };

    if (mode === "create") {
      await createCustomer.mutateAsync(payload);
      return;
    }

    if (!editCustomer) return;

    await updateCustomer.mutateAsync({ id: editCustomer.id, ...payload });
  });

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <Card className="border border-slate-200/70 bg-white/60 shadow-sm backdrop-blur-lg">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-slate-900">Customers</CardTitle>
          <p className="mt-1 text-sm text-slate-600">
            Kelola data customer dan kendaraan.
          </p>
        </div>

        <Button
          onClick={() => {
            setMode("create");
            setEditCustomer(null);
            setCustomerModalOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Tambah Customer
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-full sm:max-w-md">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama atau nomor telepon"
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
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Total Vehicles</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {listQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <div className="py-8 text-center text-sm text-slate-600">
                      Loading...
                    </div>
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <div className="py-10 text-center">
                      <p className="text-sm font-semibold text-slate-900">
                        Customer belum ada
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        Klik tombol Tambah Customer untuk membuat data baru.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                items.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-semibold">{c.name}</TableCell>
                    <TableCell>{c.phone}</TableCell>
                    <TableCell>{c.totalVehicles}</TableCell>
                    <TableCell>{formatDateShort(new Date(c.createdAt))}</TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1">
                        <Link
                          aria-label="Vehicles"
                          href={`/admin/customer/${c.id}`}
                          className={cn(
                            buttonVariants({ variant: "ghost", size: "icon" }),
                          )}
                        >
                          <CarFront className="h-4 w-4" />
                        </Link>

                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Edit"
                          onClick={() => {
                            setMode("edit");
                            setEditCustomerId(c.id);
                            setCustomerModalOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Delete"
                          onClick={() => {
                            setDeleteTarget({ id: c.id, name: c.name });
                            setDeleteModalOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
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

      <Dialog open={customerModalOpen} onOpenChange={setCustomerModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {mode === "create" ? "Tambah Customer" : "Edit Customer"}
            </DialogTitle>
            <DialogDescription>
              Isi data customer. Field bertanda wajib harus diisi.
            </DialogDescription>
          </DialogHeader>

          <form className="px-6 pb-2 pt-4" onSubmit={onSubmitCustomer}>
            <div className="grid gap-3">
              <div className="grid gap-1">
                <label className="text-sm font-semibold text-slate-700" htmlFor="name">
                  Name
                </label>
                <Input id="name" {...customerForm.register("name")} />
                {customerForm.formState.errors.name ? (
                  <p className="text-sm text-red-600">
                    {customerForm.formState.errors.name.message}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-1">
                <label className="text-sm font-semibold text-slate-700" htmlFor="phone">
                  Phone
                </label>
                <Input id="phone" {...customerForm.register("phone")} />
                {customerForm.formState.errors.phone ? (
                  <p className="text-sm text-red-600">
                    {customerForm.formState.errors.phone.message}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-1">
                <label
                  className="text-sm font-semibold text-slate-700"
                  htmlFor="address"
                >
                  Address
                </label>
                <Textarea id="address" {...customerForm.register("address")} />
                {customerForm.formState.errors.address ? (
                  <p className="text-sm text-red-600">
                    {customerForm.formState.errors.address.message}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-1">
                <label
                  className="text-sm font-semibold text-slate-700"
                  htmlFor="birthDate"
                >
                  Birth Date
                </label>
                <Input id="birthDate" type="date" {...customerForm.register("birthDate")} />
                {customerForm.formState.errors.birthDate ? (
                  <p className="text-sm text-red-600">
                    {customerForm.formState.errors.birthDate.message}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-1">
                <label className="text-sm font-semibold text-slate-700" htmlFor="note">
                  Note
                </label>
                <Textarea id="note" {...customerForm.register("note")} />
                {customerForm.formState.errors.note ? (
                  <p className="text-sm text-red-600">
                    {customerForm.formState.errors.note.message}
                  </p>
                ) : null}
              </div>
            </div>

            <DialogFooter className="px-0 pb-2 pt-6">
              <Button
                variant="secondary"
                type="button"
                onClick={() => {
                  setCustomerModalOpen(false);
                  setEditCustomerId(null);
                }}
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={createCustomer.isPending || updateCustomer.isPending}
              >
                {createCustomer.isPending || updateCustomer.isPending
                  ? "Menyimpan..."
                  : "Simpan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Hapus Customer</DialogTitle>
            <DialogDescription>
              Data customer dan kendaraan terkait akan ikut terhapus.
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 pb-2 pt-4">
            <p className="text-sm text-slate-700">
              Yakin ingin menghapus customer:
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {deleteTarget?.name ?? "-"}
            </p>
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleteModalOpen(false)}>
              Batal
            </Button>
            <Button
              variant="default"
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={!deleteTarget || deleteCustomer.isPending}
              onClick={async () => {
                if (!deleteTarget) return;
                await deleteCustomer.mutateAsync({ id: deleteTarget.id });
              }}
            >
              {deleteCustomer.isPending ? "Menghapus..." : "Hapus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

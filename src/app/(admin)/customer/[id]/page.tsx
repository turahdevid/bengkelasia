"use client";

import { useParams, useRouter } from "next/navigation";
import * as React from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "~/components/ui/button";
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
import { useToast } from "~/hooks/use-toast";
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

const vehicleFormSchema = z.object({
  plateNumber: z
    .string()
    .trim()
    .min(3, "Plat nomor wajib diisi")
    .max(16, "Plat nomor terlalu panjang")
    .transform((v) => v.toUpperCase().replace(/\s+/g, " ")),
  brand: z.string().trim().min(1, "Brand wajib diisi").max(60, "Brand terlalu panjang"),
  model: z.string().trim().min(1, "Model wajib diisi").max(60, "Model terlalu panjang"),
  year: z
    .string()
    .trim()
    .optional()
    .refine(
      (v) => {
        if (!v) return true;
        const n = Number(v);
        return Number.isInteger(n) && n >= 1900 && n <= 2100;
      },
      { message: "Tahun tidak valid" },
    ),
  color: z.string().trim().max(120).optional(),
  engineNumber: z.string().trim().max(120).optional(),
  chassisNumber: z.string().trim().max(120).optional(),
  currentOdometer: z
    .string()
    .trim()
    .optional()
    .refine(
      (v) => {
        if (!v) return true;
        const n = Number(v);
        return Number.isInteger(n) && n >= 0;
      },
      { message: "Odometer tidak valid" },
    ),
  note: z.string().trim().max(500).optional(),
});

type VehicleFormValues = z.infer<typeof vehicleFormSchema>;

type EditVehicle = {
  id: string;
  plateNumber: string;
  brand: string;
  model: string;
  year: number | null;
  color: string | null;
  engineNumber: string | null;
  chassisNumber: string | null;
  currentOdometer: number | null;
  note: string | null;
};

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateLong(d: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(d);
}

export default function CustomerDetailPage() {
  const router = useRouter();
  const params = useParams<{ id?: string }>();
  const id = params.id ?? "";

  const utils = api.useUtils();
  const { toast } = useToast();

  const detailQuery = api.customer.getById.useQuery(
    { id },
    { enabled: !!id, retry: false },
  );

  const [editCustomerOpen, setEditCustomerOpen] = React.useState(false);
  const [vehicleModalOpen, setVehicleModalOpen] = React.useState(false);
  const [vehicleMode, setVehicleMode] = React.useState<"create" | "edit">("create");
  const [editVehicle, setEditVehicle] = React.useState<EditVehicle | null>(null);
  const [deleteVehicleTarget, setDeleteVehicleTarget] = React.useState<{
    id: string;
    plateNumber: string;
  } | null>(null);
  const [deleteVehicleOpen, setDeleteVehicleOpen] = React.useState(false);

  const updateCustomer = api.customer.update.useMutation({
    onSuccess: async () => {
      await utils.customer.getById.invalidate({ id });
      toast({ variant: "success", title: "Customer berhasil diupdate" });
      setEditCustomerOpen(false);
    },
    onError: (e) =>
      toast({ variant: "destructive", title: "Gagal update customer", description: e.message }),
  });

  const createVehicle = api.customer.createVehicle.useMutation({
    onSuccess: async () => {
      await utils.customer.getById.invalidate({ id });
      toast({ variant: "success", title: "Kendaraan berhasil ditambahkan" });
      setVehicleModalOpen(false);
    },
    onError: (e) =>
      toast({ variant: "destructive", title: "Gagal tambah kendaraan", description: e.message }),
  });

  const updateVehicle = api.customer.updateVehicle.useMutation({
    onSuccess: async () => {
      await utils.customer.getById.invalidate({ id });
      toast({ variant: "success", title: "Kendaraan berhasil diupdate" });
      setVehicleModalOpen(false);
    },
    onError: (e) =>
      toast({ variant: "destructive", title: "Gagal update kendaraan", description: e.message }),
  });

  const deleteVehicle = api.customer.deleteVehicle.useMutation({
    onSuccess: async () => {
      await utils.customer.getById.invalidate({ id });
      toast({ variant: "success", title: "Kendaraan berhasil dihapus" });
      setDeleteVehicleOpen(false);
      setDeleteVehicleTarget(null);
    },
    onError: (e) =>
      toast({ variant: "destructive", title: "Gagal hapus kendaraan", description: e.message }),
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
    if (!editCustomerOpen) return;
    const c = detailQuery.data;
    if (!c) return;

    customerForm.reset({
      name: c.name,
      phone: c.phone,
      address: c.address ?? "",
      birthDate: c.birthDate ? toDateInputValue(new Date(c.birthDate)) : "",
      note: c.note ?? "",
    });
  }, [customerForm, detailQuery.data, editCustomerOpen]);

  const onSubmitCustomer = customerForm.handleSubmit(async (values) => {
    await updateCustomer.mutateAsync({
      id,
      name: values.name,
      phone: values.phone,
      address: values.address?.trim() ? values.address.trim() : undefined,
      birthDate: values.birthDate?.trim() ? values.birthDate.trim() : undefined,
      note: values.note?.trim() ? values.note.trim() : undefined,
    });
  });

  const vehicleForm = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleFormSchema),
    defaultValues: {
      plateNumber: "",
      brand: "",
      model: "",
      year: "",
      color: "",
      engineNumber: "",
      chassisNumber: "",
      currentOdometer: "",
      note: "",
    },
  });

  React.useEffect(() => {
    if (!vehicleModalOpen) return;

    if (vehicleMode === "create") {
      vehicleForm.reset({
        plateNumber: "",
        brand: "",
        model: "",
        year: "",
        color: "",
        engineNumber: "",
        chassisNumber: "",
        currentOdometer: "",
        note: "",
      });
      return;
    }

    if (!editVehicle) return;

    vehicleForm.reset({
      plateNumber: editVehicle.plateNumber,
      brand: editVehicle.brand,
      model: editVehicle.model,
      year: editVehicle.year !== null ? String(editVehicle.year) : "",
      color: editVehicle.color ?? "",
      engineNumber: editVehicle.engineNumber ?? "",
      chassisNumber: editVehicle.chassisNumber ?? "",
      currentOdometer:
        editVehicle.currentOdometer !== null
          ? String(editVehicle.currentOdometer)
          : "",
      note: editVehicle.note ?? "",
    });
  }, [editVehicle, vehicleForm, vehicleModalOpen, vehicleMode]);

  const onSubmitVehicle = vehicleForm.handleSubmit(async (values) => {
    const year = values.year?.trim() ? Number(values.year) : undefined;
    const currentOdometer = values.currentOdometer?.trim()
      ? Number(values.currentOdometer)
      : undefined;

    const payload = {
      customerId: id,
      plateNumber: values.plateNumber,
      brand: values.brand,
      model: values.model,
      year,
      color: values.color?.trim() ? values.color.trim() : undefined,
      engineNumber: values.engineNumber?.trim() ? values.engineNumber.trim() : undefined,
      chassisNumber: values.chassisNumber?.trim() ? values.chassisNumber.trim() : undefined,
      currentOdometer,
      note: values.note?.trim() ? values.note.trim() : undefined,
    };

    if (vehicleMode === "create") {
      await createVehicle.mutateAsync(payload);
      return;
    }

    if (!editVehicle) return;

    await updateVehicle.mutateAsync({ id: editVehicle.id, ...payload });
  });

  if (detailQuery.isLoading) {
    return (
      <Card className="border border-slate-200/70 bg-white/60 shadow-sm backdrop-blur-lg">
        <CardContent className="py-10 text-center text-sm text-slate-600">
          Loading...
        </CardContent>
      </Card>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <Card className="border border-slate-200/70 bg-white/60 shadow-sm backdrop-blur-lg">
        <CardContent className="py-10 text-center">
          <p className="text-sm font-semibold text-slate-900">
            Customer tidak ditemukan
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Kembali ke halaman list customer.
          </p>
          <div className="mt-4">
            <Button variant="secondary" onClick={() => router.push("/admin/customer")}
            >
              Kembali
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const customer = detailQuery.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="secondary" onClick={() => router.push("/admin/customer")}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </div>

      <Card className="border border-slate-200/70 bg-white/60 shadow-sm backdrop-blur-lg">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-slate-900">{customer.name}</CardTitle>
            <p className="mt-1 text-sm text-slate-600">{customer.phone}</p>
          </div>

          <Button
            variant="secondary"
            onClick={() => setEditCustomerOpen(true)}
            aria-label="Edit customer"
          >
            <Pencil className="h-4 w-4" />
            Edit Customer
          </Button>
        </CardHeader>

        <CardContent className="grid gap-3 text-sm text-slate-800 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold text-slate-600">Address</p>
            <p className="mt-1">{customer.address ?? "-"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-600">Birth Date</p>
            <p className="mt-1">
              {customer.birthDate ? formatDateLong(new Date(customer.birthDate)) : "-"}
            </p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs font-semibold text-slate-600">Note</p>
            <p className="mt-1 whitespace-pre-wrap">{customer.note ?? "-"}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-slate-200/70 bg-white/60 shadow-sm backdrop-blur-lg">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-slate-900">Vehicles</CardTitle>
            <p className="mt-1 text-sm text-slate-600">
              Tambah, edit, dan hapus kendaraan milik customer.
            </p>
          </div>

          <Button
            onClick={() => {
              setVehicleMode("create");
              setEditVehicle(null);
              setVehicleModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Add Vehicle
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-2xl border border-slate-200/70 bg-white/40 shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plate Number</TableHead>
                  <TableHead>Brand / Model</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead>Odometer</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {customer.vehicles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <div className="py-10 text-center">
                        <p className="text-sm font-semibold text-slate-900">
                          Kendaraan belum ada
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          Klik tombol Add Vehicle untuk menambahkan kendaraan.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  customer.vehicles.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-semibold">{v.plateNumber}</TableCell>
                      <TableCell>
                        {v.brand} / {v.model}
                      </TableCell>
                      <TableCell>{v.year ?? "-"}</TableCell>
                      <TableCell>{v.color ?? "-"}</TableCell>
                      <TableCell>{v.currentOdometer ?? "-"}</TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Edit vehicle"
                            onClick={() => {
                              setVehicleMode("edit");
                              setEditVehicle({
                                id: v.id,
                                plateNumber: v.plateNumber,
                                brand: v.brand,
                                model: v.model,
                                year: v.year,
                                color: v.color,
                                engineNumber: v.engineNumber,
                                chassisNumber: v.chassisNumber,
                                currentOdometer: v.currentOdometer,
                                note: v.note,
                              });
                              setVehicleModalOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Delete vehicle"
                            onClick={() => {
                              setDeleteVehicleTarget({ id: v.id, plateNumber: v.plateNumber });
                              setDeleteVehicleOpen(true);
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
        </CardContent>
      </Card>

      <Dialog open={editCustomerOpen} onOpenChange={setEditCustomerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Customer</DialogTitle>
            <DialogDescription>Perbarui informasi customer.</DialogDescription>
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
              </div>
            </div>

            <DialogFooter className="px-0 pb-2 pt-6">
              <Button
                variant="secondary"
                type="button"
                onClick={() => setEditCustomerOpen(false)}
              >
                Batal
              </Button>
              <Button type="submit" disabled={updateCustomer.isPending}>
                {updateCustomer.isPending ? "Menyimpan..." : "Simpan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={vehicleModalOpen} onOpenChange={setVehicleModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {vehicleMode === "create" ? "Add Vehicle" : "Edit Vehicle"}
            </DialogTitle>
            <DialogDescription>
              Pastikan plat nomor benar karena akan dipakai untuk pencarian.
            </DialogDescription>
          </DialogHeader>

          <form className="px-6 pb-2 pt-4" onSubmit={onSubmitVehicle}>
            <div className="grid gap-3">
              <div className="grid gap-1">
                <label
                  className="text-sm font-semibold text-slate-700"
                  htmlFor="plateNumber"
                >
                  Plate Number
                </label>
                <Input id="plateNumber" {...vehicleForm.register("plateNumber")} />
                {vehicleForm.formState.errors.plateNumber ? (
                  <p className="text-sm text-red-600">
                    {vehicleForm.formState.errors.plateNumber.message}
                  </p>
                ) : null}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid gap-1">
                  <label className="text-sm font-semibold text-slate-700" htmlFor="brand">
                    Brand
                  </label>
                  <Input id="brand" {...vehicleForm.register("brand")} />
                  {vehicleForm.formState.errors.brand ? (
                    <p className="text-sm text-red-600">
                      {vehicleForm.formState.errors.brand.message}
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-1">
                  <label className="text-sm font-semibold text-slate-700" htmlFor="model">
                    Model
                  </label>
                  <Input id="model" {...vehicleForm.register("model")} />
                  {vehicleForm.formState.errors.model ? (
                    <p className="text-sm text-red-600">
                      {vehicleForm.formState.errors.model.message}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid gap-1">
                  <label className="text-sm font-semibold text-slate-700" htmlFor="year">
                    Year
                  </label>
                  <Input id="year" inputMode="numeric" {...vehicleForm.register("year")} />
                  {vehicleForm.formState.errors.year ? (
                    <p className="text-sm text-red-600">
                      {vehicleForm.formState.errors.year.message}
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-1">
                  <label className="text-sm font-semibold text-slate-700" htmlFor="color">
                    Color
                  </label>
                  <Input id="color" {...vehicleForm.register("color")} />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid gap-1">
                  <label
                    className="text-sm font-semibold text-slate-700"
                    htmlFor="engineNumber"
                  >
                    Engine Number
                  </label>
                  <Input id="engineNumber" {...vehicleForm.register("engineNumber")} />
                </div>

                <div className="grid gap-1">
                  <label
                    className="text-sm font-semibold text-slate-700"
                    htmlFor="chassisNumber"
                  >
                    Chassis Number
                  </label>
                  <Input id="chassisNumber" {...vehicleForm.register("chassisNumber")} />
                </div>
              </div>

              <div className="grid gap-1">
                <label
                  className="text-sm font-semibold text-slate-700"
                  htmlFor="currentOdometer"
                >
                  Odometer
                </label>
                <Input
                  id="currentOdometer"
                  inputMode="numeric"
                  {...vehicleForm.register("currentOdometer")}
                />
                {vehicleForm.formState.errors.currentOdometer ? (
                  <p className="text-sm text-red-600">
                    {vehicleForm.formState.errors.currentOdometer.message}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-1">
                <label className="text-sm font-semibold text-slate-700" htmlFor="note">
                  Note
                </label>
                <Textarea id="note" {...vehicleForm.register("note")} />
              </div>
            </div>

            <DialogFooter className="px-0 pb-2 pt-6">
              <Button
                variant="secondary"
                type="button"
                onClick={() => setVehicleModalOpen(false)}
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={createVehicle.isPending || updateVehicle.isPending}
              >
                {createVehicle.isPending || updateVehicle.isPending
                  ? "Menyimpan..."
                  : "Simpan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteVehicleOpen} onOpenChange={setDeleteVehicleOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Hapus Kendaraan</DialogTitle>
            <DialogDescription>Kendaraan akan dihapus permanen.</DialogDescription>
          </DialogHeader>

          <div className="px-6 pb-2 pt-4">
            <p className="text-sm text-slate-700">Yakin ingin menghapus:</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {deleteVehicleTarget?.plateNumber ?? "-"}
            </p>
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleteVehicleOpen(false)}>
              Batal
            </Button>
            <Button
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={!deleteVehicleTarget || deleteVehicle.isPending}
              onClick={async () => {
                if (!deleteVehicleTarget) return;
                await deleteVehicle.mutateAsync({
                  id: deleteVehicleTarget.id,
                  customerId: id,
                });
              }}
            >
              {deleteVehicle.isPending ? "Menghapus..." : "Hapus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

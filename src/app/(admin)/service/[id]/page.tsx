"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";

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
import { Textarea } from "~/components/ui/textarea";
import { useDebouncedValue } from "~/hooks/use-debounced-value";
import { useToast } from "~/hooks/use-toast";
import { cn, formatRupiah, parseRupiah } from "~/lib/utils";
import { api } from "~/trpc/react";
import { type RouterInputs, type RouterOutputs } from "~/trpc/react";

type WorkOrderGetById = RouterOutputs["service"]["getById"];
type WorkOrderItem = WorkOrderGetById["items"][number];
type WorkOrderMechanic = WorkOrderGetById["mechanics"][number];
type UpdatePartialInput = RouterInputs["service"]["updatePartial"];

type TabKey = "customer" | "order" | "items" | "payment";

type JasaLine = {
  clientId: string;
  name: string;
  qty: string;
  price: string;
};

type StockZeroConfirm =
  | {
      open: true;
      kind: "SPAREPART" | "OIL";
      productId: string;
      name: string;
      brand?: string | null;
      stockAvailable: number;
    }
  | { open: false };

type Draft = {
  id: string;
  woNumber: string;
  status: "DRAFT" | "ANTRIAN" | "PROSES" | "SELESAI" | "DIAMBIL" | "OPEN" | "DONE" | "CANCELLED";

  customerMode: "existing" | "new";
  customerId: string;
  vehicleId: string;

  newCustomer: { name: string; phone: string; address: string };
  newVehicle: {
    plateNumber: string;
    brand: string;
    model: string;
    engineNumber: string;
    chassisNumber: string;
    km: string;
  };

  jobType: string;

  complaint: string;
  odo: string;
  dateTime: string;

  preCheck: string;
  postCheck: string;

  advisorId: string;
  mechanicIds: string[];

  dp: string;
  discountPercent: string;
  taxPercent: string;
  paidAmount: string;
  paymentMethod: "CASH" | "TRANSFER";
};

function nowLocalInputValue() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

function safeInt(v: string) {
  const trimmed = v.trim();
  if (!trimmed) return 0;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return 0;
  const i = Math.floor(n);
  return i < 0 ? 0 : i;
}

function makeClientId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random()}`;
}

function formatRupiahInput(value: string) {
  return formatRupiah(parseRupiah(value), { prefix: false });
}

function statusLabel(s: Draft["status"]) {
  switch (s) {
    case "DRAFT":
      return "Draft";
    case "ANTRIAN":
      return "Antrian";
    case "PROSES":
      return "Proses";
    case "SELESAI":
      return "Selesai";
    case "DIAMBIL":
      return "Diambil";
    case "OPEN":
      return "Open";
    case "DONE":
      return "Done";
    case "CANCELLED":
      return "Cancelled";
  }
}

function statusColor(s: Draft["status"]) {
  switch (s) {
    case "DRAFT":
      return "bg-slate-100 text-slate-700 border-slate-200";
    case "ANTRIAN":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "PROSES":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "SELESAI":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "DIAMBIL":
      return "bg-purple-50 text-purple-700 border-purple-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

function canGoNextStatus(current: Draft["status"], next: Draft["status"]) {
  return (
    (current === "DRAFT" && next === "ANTRIAN") ||
    (current === "ANTRIAN" && next === "PROSES") ||
    (current === "PROSES" && next === "SELESAI") ||
    (current === "SELESAI" && next === "DIAMBIL")
  );
}

export default function WorkOrderFormPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const utils = api.useUtils();

  const params = useParams<{ id: string }>();
  const woId = params?.id ? String(params.id) : "";

  const [tab, setTab] = React.useState<TabKey>("customer");

  React.useEffect(() => {
    const t = searchParams?.get("tab");
    if (t === "customer" || t === "order" || t === "items" || t === "payment") {
      setTab(t);
    }
  }, [searchParams]);

  const [draft, setDraft] = React.useState<Draft>(() => ({
    id: woId,
    woNumber: "",
    status: "DRAFT",

    customerMode: "existing",
    customerId: "",
    vehicleId: "",

    newCustomer: { name: "", phone: "", address: "" },
    newVehicle: {
      plateNumber: "",
      brand: "",
      model: "",
      engineNumber: "",
      chassisNumber: "",
      km: "",
    },

    jobType: "",

    complaint: "",
    odo: "",
    dateTime: nowLocalInputValue(),

    preCheck: "",
    postCheck: "",

    advisorId: "",
    mechanicIds: [],

    dp: "0",
    discountPercent: "0",
    taxPercent: "0",
    paidAmount: "0",
    paymentMethod: "CASH",
  }));

  const woQuery = api.service.getById.useQuery(
    { id: woId },
    {
      retry: false,
      enabled: Boolean(woId),
    },
  );

  const [jasaLines, setJasaLines] = React.useState<JasaLine[]>([]);

  React.useEffect(() => {
    const wo = woQuery.data;
    if (!wo) return;

    const jasa = (wo.items ?? []).filter((it) => it.type === "JASA");
    setJasaLines(
      jasa.map((it) => ({
        clientId: makeClientId(),
        name: it.name ?? "",
        qty: String(it.qty ?? 1),
        price: formatRupiah(it.price ?? 0, { prefix: false }),
      })),
    );
  }, [woQuery.data, woQuery.data?.updatedAt]);

  React.useEffect(() => {
    const wo = woQuery.data;
    if (!wo) return;

    setDraft((d) => ({
      ...d,
      woNumber: wo.woNumber,
      status: wo.status as Draft["status"],
      customerId: wo.customerId ?? "",
      vehicleId: wo.vehicleId ?? "",
      jobType: wo.jobType ?? "",
      complaint: wo.complaint ?? "",
      odo: wo.odo != null ? String(wo.odo) : "",
      dateTime: wo.createdAt ? new Date(wo.createdAt).toISOString().slice(0, 16) : d.dateTime,
      advisorId: wo.advisorId ?? "",
      mechanicIds: (wo.mechanics ?? []).map((m: WorkOrderMechanic) => m.userId),
      preCheck: wo.preCheck ?? "",
      postCheck: wo.postCheck ?? "",
      dp: formatRupiah(wo.dp ?? 0, { prefix: false }),
      discountPercent: String(wo.discountPercent ?? 0),
      taxPercent: String(wo.taxPercent ?? 0),
      paidAmount: formatRupiah(wo.paidAmount ?? 0, { prefix: false }),
      paymentMethod: (wo.paymentMethod ?? "CASH") as "CASH" | "TRANSFER",
    }));
  }, [woQuery.data]);

  const mechanicsQuery = api.service.listMechanics.useQuery();
  const advisorsQuery = api.service.listAdvisors.useQuery();

  const [customerSearch, setCustomerSearch] = React.useState("");
  const customerSearchDebounced = useDebouncedValue(customerSearch, 300);
  const customersQuery = api.service.searchCustomers.useQuery(
    { query: customerSearchDebounced || "-", limit: 10 },
    { enabled: customerSearchDebounced.trim().length > 0 },
  );

  const vehiclesQuery = api.service.listVehiclesByCustomer.useQuery(
    { customerId: draft.customerId },
    { enabled: Boolean(draft.customerId) && draft.customerMode === "existing" },
  );

  const [mechanicOpen, setMechanicOpen] = React.useState(false);
  const [mechanicSearch, setMechanicSearch] = React.useState("");

  const [sparepartQuery, setSparepartQuery] = React.useState("");
  const sparepartQueryDebounced = useDebouncedValue(sparepartQuery, 300);
  const sparepartsQuery = api.service.listProductsSparepart.useQuery(
    { query: sparepartQueryDebounced.trim() ? sparepartQueryDebounced.trim() : undefined, limit: 50 },
    { retry: false },
  );

  const [oilQuery, setOilQuery] = React.useState("");
  const oilQueryDebounced = useDebouncedValue(oilQuery, 300);
  const oilsGroupedQuery = api.service.listProductsOilGrouped.useQuery(
    { query: oilQueryDebounced.trim() ? oilQueryDebounced.trim() : undefined, limit: 50 },
    { retry: false },
  );

  const [sparepartId, setSparepartId] = React.useState("");
  const [sparepartQty, setSparepartQty] = React.useState("1");
  const [oilId, setOilId] = React.useState("");
  const [oilQty, setOilQty] = React.useState("1");

  const [sparepartBrand, setSparepartBrand] = React.useState<string>("Semua");
  const [oilBrand, setOilBrand] = React.useState<string>("Semua");

  const [stockZeroConfirm, setStockZeroConfirm] = React.useState<StockZeroConfirm>({ open: false });

  const saveMutation = api.service.updatePartial.useMutation({
    onSuccess: async () => {
      toast({ variant: "success", title: "WO tersimpan" });
      await Promise.all([
        utils.service.getById.invalidate({ id: woId }),
        utils.service.searchWorkOrders.invalidate(),
        utils.service.recent.invalidate(),
      ]);
    },
    onError: (e) => toast({ variant: "destructive", title: "Gagal", description: e.message }),
  });

  const replaceJasaMutation = api.service.replaceJasaItems.useMutation({
    onSuccess: async () => {
      toast({ variant: "success", title: "Jasa tersimpan" });
      await Promise.all([
        utils.service.getById.invalidate({ id: woId }),
        utils.service.searchWorkOrders.invalidate(),
        utils.service.recent.invalidate(),
      ]);
    },
    onError: (e) => toast({ variant: "destructive", title: "Gagal", description: e.message }),
  });

  const addSparepartMutation = api.service.addSparepartItem.useMutation({
    onSuccess: async () => {
      toast({ variant: "success", title: "Sparepart ditambahkan" });
      setSparepartId("");
      setSparepartQty("1");
      await Promise.all([
        utils.service.getById.invalidate({ id: woId }),
        utils.service.searchWorkOrders.invalidate(),
        utils.service.recent.invalidate(),
      ]);
    },
    onError: (e) => toast({ variant: "destructive", title: "Gagal", description: e.message }),
  });

  const addOilMutation = api.service.addOilItem.useMutation({
    onSuccess: async () => {
      toast({ variant: "success", title: "Oli ditambahkan" });
      setOilId("");
      setOilQty("1");
      await Promise.all([
        utils.service.getById.invalidate({ id: woId }),
        utils.service.searchWorkOrders.invalidate(),
        utils.service.recent.invalidate(),
      ]);
    },
    onError: (e) => toast({ variant: "destructive", title: "Gagal", description: e.message }),
  });

  const setStatusMutation = api.service.setStatus.useMutation({
    onSuccess: async () => {
      toast({ variant: "success", title: "Status diupdate" });
      await Promise.all([
        utils.service.getById.invalidate({ id: woId }),
        utils.service.searchWorkOrders.invalidate(),
        utils.service.recent.invalidate(),
      ]);
    },
    onError: (e) => toast({ variant: "destructive", title: "Gagal", description: e.message }),
  });

  const confirmAddStockZero = React.useCallback(() => {
    if (!stockZeroConfirm.open) return;

    if (stockZeroConfirm.kind === "SPAREPART") {
      const qty = Math.max(1, safeInt(sparepartQty));
      addSparepartMutation.mutate({ workOrderId: woId, productId: stockZeroConfirm.productId, qty });
    } else {
      const qty = Math.max(1, safeInt(oilQty));
      addOilMutation.mutate({ workOrderId: woId, productId: stockZeroConfirm.productId, qty });
    }

    setStockZeroConfirm({ open: false });
  }, [
    addOilMutation,
    addSparepartMutation,
    oilQty,
    sparepartQty,
    stockZeroConfirm,
    woId,
  ]);

  const onSave = React.useCallback(async () => {
    const basePayload: UpdatePartialInput = {
      id: woId,
      woNumber: draft.woNumber?.trim() ? draft.woNumber.trim() : undefined,
      dateTime: draft.dateTime?.trim() ? new Date(draft.dateTime).toISOString() : undefined,
      jobType: draft.jobType.trim() ? draft.jobType : null,
      odo: draft.odo.trim() ? safeInt(draft.odo) : undefined,
      complaint: draft.complaint.trim() ? draft.complaint : undefined,
      advisorId: draft.advisorId.trim() ? draft.advisorId : null,
      mechanicIds: draft.mechanicIds,

      preCheck: draft.preCheck.trim() ? draft.preCheck : null,
      postCheck: draft.postCheck.trim() ? draft.postCheck : null,

      dp: parseRupiah(draft.dp),
      discountPercent: safeInt(draft.discountPercent),
      taxPercent: safeInt(draft.taxPercent),
      paidAmount: parseRupiah(draft.paidAmount),
      paymentMethod: draft.paymentMethod,
    };

    const payload: UpdatePartialInput =
      draft.customerMode === "existing"
        ? {
            ...basePayload,
            customerId: draft.customerId.trim() ? draft.customerId : null,
            vehicleId: draft.vehicleId.trim() ? draft.vehicleId : null,
          }
        : {
            ...basePayload,
            customerId: null,
            vehicleId: null,
            newCustomer: {
              name: draft.newCustomer.name,
              phone: draft.newCustomer.phone,
              address: draft.newCustomer.address || undefined,
            },
            newVehicle: {
              plateNumber: draft.newVehicle.plateNumber,
              brand: draft.newVehicle.brand,
              model: draft.newVehicle.model,
              engineNumber: draft.newVehicle.engineNumber.trim()
                ? draft.newVehicle.engineNumber
                : undefined,
              chassisNumber: draft.newVehicle.chassisNumber.trim()
                ? draft.newVehicle.chassisNumber
                : undefined,
              currentOdometer: draft.newVehicle.km.trim()
                ? safeInt(draft.newVehicle.km)
                : undefined,
            },
          };

    await saveMutation.mutateAsync(payload);
  }, [draft, saveMutation, woId]);

  const jasaSubtotal = React.useMemo(() => {
    return jasaLines.reduce((acc, it) => {
      const qty = Math.max(0, safeInt(it.qty));
      const price = parseRupiah(it.price);
      return acc + qty * price;
    }, 0);
  }, [jasaLines]);

  const statusOptions: Draft["status"][] = ["DRAFT", "ANTRIAN", "PROSES", "SELESAI", "DIAMBIL"];

  const headerRight = (
    <div className="flex flex-wrap items-center gap-2">
      <Button asChild variant="secondary">
        <a href={`/admin/service/${woId}/print`} target="_blank" rel="noreferrer">
          Print
        </a>
      </Button>
      <span
        className={cn(
          "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold",
          statusColor(draft.status),
        )}
      >
        {statusLabel(draft.status)}
      </span>

      <select
        className={cn(
          "h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200",
        )}
        value={draft.status}
        onChange={async (e) => {
          const next = e.target.value as Draft["status"];
          if (next === draft.status) return;
          if (!canGoNextStatus(draft.status, next)) {
            toast({
              variant: "destructive",
              title: "Transisi status tidak valid",
              description: `${statusLabel(draft.status)} -> ${statusLabel(next)}`,
            });
            return;
          }
          await setStatusMutation.mutateAsync({ id: woId, status: next });
          setDraft((d) => ({ ...d, status: next }));
        }}
      >
        {statusOptions.map((s) => (
          <option key={s} value={s}>
            {statusLabel(s)}
          </option>
        ))}
      </select>

      <Button onClick={() => void onSave()} disabled={saveMutation.isPending}>
        {saveMutation.isPending ? "Menyimpan..." : "Simpan"}
      </Button>

      <Button
        variant="secondary"
        onClick={() => {
          router.push("/admin/service");
        }}
      >
        Kembali
      </Button>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <Dialog
        open={stockZeroConfirm.open}
        onOpenChange={(open) => {
          if (!open) setStockZeroConfirm({ open: false });
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Stok 0</DialogTitle>
            <DialogDescription>
              {stockZeroConfirm.open
                ? `Stok untuk ${stockZeroConfirm.name} (${(stockZeroConfirm.brand ?? "-").trim() || "-"}) adalah 0. Tetap tambahkan ke WO?`
                : ""}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="secondary" type="button" onClick={() => setStockZeroConfirm({ open: false })}>
              Batal
            </Button>
            <Button
              type="button"
              onClick={confirmAddStockZero}
              disabled={addSparepartMutation.isPending || addOilMutation.isPending}
            >
              Lanjut
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-wrap gap-2">
        <TabButton active={tab === "customer"} onClick={() => setTab("customer")}>
          Customer
        </TabButton>
        <TabButton active={tab === "order"} onClick={() => setTab("order")}>
          Order
        </TabButton>
        <TabButton active={tab === "items"} onClick={() => setTab("items")}>
          Items
        </TabButton>
        <TabButton active={tab === "payment"} onClick={() => setTab("payment")}>
          Payment
        </TabButton>
      </div>

      <div className="grid gap-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="WO Number">
            <Input
              value={draft.woNumber}
              onChange={(e) => setDraft((d) => ({ ...d, woNumber: e.target.value }))}
            />
          </Field>

          <Field label="Tanggal">
            <Input
              type="datetime-local"
              value={draft.dateTime}
              onChange={(e) => setDraft((d) => ({ ...d, dateTime: e.target.value }))}
            />
          </Field>
        </div>

          {tab === "customer" ? (
            <div className="grid gap-3">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={draft.customerMode === "existing" ? "default" : "secondary"}
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      customerMode: "existing",
                      newCustomer: { name: "", phone: "", address: "" },
                      newVehicle: {
                        plateNumber: "",
                        brand: "",
                        model: "",
                        engineNumber: "",
                        chassisNumber: "",
                        km: "",
                      },
                    }))
                  }
                >
                  Pilih Customer
                </Button>
                <Button
                  type="button"
                  variant={draft.customerMode === "new" ? "default" : "secondary"}
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      customerMode: "new",
                      customerId: "",
                      vehicleId: "",
                    }))
                  }
                >
                  Customer Baru
                </Button>
              </div>

              {draft.customerMode === "existing" ? (
                <div className="grid gap-3">
                  <Field label="Cari Customer">
                    <Input
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      placeholder="Nama / No HP"
                    />
                  </Field>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <Field label="Customer">
                      <select
                        className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm"
                        value={draft.customerId}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            customerId: e.target.value,
                            vehicleId: "",
                          }))
                        }
                      >
                        <option value="">-</option>
                        {(customersQuery.data ?? []).map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.phone})
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Kendaraan">
                      <select
                        className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm"
                        value={draft.vehicleId}
                        onChange={(e) => setDraft((d) => ({ ...d, vehicleId: e.target.value }))}
                        disabled={!draft.customerId}
                      >
                        <option value="">-</option>
                        {(vehiclesQuery.data ?? []).map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.plateNumber} - {v.brand} {v.model}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Nama Customer">
                    <Input
                      value={draft.newCustomer.name}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          newCustomer: { ...d.newCustomer, name: e.target.value },
                        }))
                      }
                    />
                  </Field>
                  <Field label="No HP">
                    <Input
                      value={draft.newCustomer.phone}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          newCustomer: { ...d.newCustomer, phone: e.target.value },
                        }))
                      }
                    />
                  </Field>
                  <Field label="Alamat" className="sm:col-span-2">
                    <Input
                      value={draft.newCustomer.address}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          newCustomer: { ...d.newCustomer, address: e.target.value },
                        }))
                      }
                    />
                  </Field>

                  <Field label="Plat Nomor">
                    <Input
                      value={draft.newVehicle.plateNumber}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          newVehicle: { ...d.newVehicle, plateNumber: e.target.value },
                        }))
                      }
                    />
                  </Field>
                  <Field label="Merk">
                    <Input
                      value={draft.newVehicle.brand}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          newVehicle: { ...d.newVehicle, brand: e.target.value },
                        }))
                      }
                    />
                  </Field>
                  <Field label="Model">
                    <Input
                      value={draft.newVehicle.model}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          newVehicle: { ...d.newVehicle, model: e.target.value },
                        }))
                      }
                    />
                  </Field>
                  <Field label="No Mesin">
                    <Input
                      value={draft.newVehicle.engineNumber}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          newVehicle: { ...d.newVehicle, engineNumber: e.target.value },
                        }))
                      }
                    />
                  </Field>
                  <Field label="No Rangka">
                    <Input
                      value={draft.newVehicle.chassisNumber}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          newVehicle: { ...d.newVehicle, chassisNumber: e.target.value },
                        }))
                      }
                    />
                  </Field>
                  <Field label="KM">
                    <Input
                      value={draft.newVehicle.km}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          newVehicle: { ...d.newVehicle, km: e.target.value },
                        }))
                      }
                      inputMode="numeric"
                    />
                  </Field>
                </div>
              )}
            </div>
          ) : null}

          {tab === "order" ? (
            <div className="grid gap-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="KM / Odometer">
                  <Input
                    value={draft.odo}
                    onChange={(e) => setDraft((d) => ({ ...d, odo: e.target.value }))}
                    inputMode="numeric"
                  />
                </Field>
                <Field label="Jenis Pekerjaan">
                  <Input
                    value={draft.jobType}
                    onChange={(e) => setDraft((d) => ({ ...d, jobType: e.target.value }))}
                    placeholder="Contoh: WALK IN"
                  />
                </Field>
                <Field label="Advisor">
                  <select
                    className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm"
                    value={draft.advisorId}
                    onChange={(e) => setDraft((d) => ({ ...d, advisorId: e.target.value }))}
                  >
                    <option value="">-</option>
                    {(advisorsQuery.data ?? []).map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name ?? u.email}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Mechanic (Multi)">
                  <div className="relative">
                    <button
                      type="button"
                      className="flex min-h-10 w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                      onClick={() => setMechanicOpen((v) => !v)}
                    >
                      <span className={cn("truncate", draft.mechanicIds.length === 0 && "text-slate-400")}>
                        {draft.mechanicIds.length === 0
                          ? "Pilih mekanik"
                          : `${draft.mechanicIds.length} mekanik dipilih`}
                      </span>
                      <span className="text-slate-400">▾</span>
                    </button>

                    {draft.mechanicIds.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {draft.mechanicIds
                          .map((id) => (mechanicsQuery.data ?? []).find((m) => m.id === id))
                          .filter(Boolean)
                          .map((m) => (
                            <span
                              key={(m as { id: string }).id}
                              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700"
                            >
                              {(m as { name: string | null; email: string }).name ??
                                (m as { name: string | null; email: string }).email}
                              <button
                                type="button"
                                className="text-slate-500 hover:text-slate-900"
                                onClick={() =>
                                  setDraft((d) => ({
                                    ...d,
                                    mechanicIds: d.mechanicIds.filter((x) => x !== (m as { id: string }).id),
                                  }))
                                }
                                aria-label="Remove mechanic"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                      </div>
                    ) : null}

                    {mechanicOpen ? (
                      <div className="absolute z-20 mt-2 w-full rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
                        <Input
                          value={mechanicSearch}
                          onChange={(e) => setMechanicSearch(e.target.value)}
                          placeholder="Cari mekanik..."
                        />

                        <div className="mt-2 max-h-64 overflow-auto">
                          {(mechanicsQuery.data ?? [])
                            .filter((m) => {
                              const label = `${m.name ?? ""} ${m.email ?? ""}`.toLowerCase();
                              return label.includes(mechanicSearch.trim().toLowerCase());
                            })
                            .map((m) => {
                              const active = draft.mechanicIds.includes(m.id);
                              return (
                                <button
                                  key={m.id}
                                  type="button"
                                  className={cn(
                                    "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm hover:bg-slate-50",
                                    active && "bg-slate-50",
                                  )}
                                  onClick={() =>
                                    setDraft((d) => ({
                                      ...d,
                                      mechanicIds: active
                                        ? d.mechanicIds.filter((x) => x !== m.id)
                                        : [...d.mechanicIds, m.id],
                                    }))
                                  }
                                >
                                  <span className="truncate">{m.name ?? m.email}</span>
                                  <span
                                    className={cn(
                                      "ml-3 inline-flex h-5 w-5 items-center justify-center rounded border text-xs",
                                      active
                                        ? "border-slate-900 bg-slate-900 text-white"
                                        : "border-slate-200 bg-white text-transparent",
                                    )}
                                  >
                                    ✓
                                  </span>
                                </button>
                              );
                            })}

                          {(mechanicsQuery.data ?? []).length > 0 &&
                          (mechanicsQuery.data ?? []).filter((m) => {
                            const label = `${m.name ?? ""} ${m.email ?? ""}`.toLowerCase();
                            return label.includes(mechanicSearch.trim().toLowerCase());
                          }).length === 0 ? (
                            <div className="px-3 py-4 text-sm text-slate-500">Tidak ada hasil.</div>
                          ) : null}
                        </div>

                        <div className="mt-2 flex justify-end gap-2">
                          <Button
                            variant="secondary"
                            type="button"
                            onClick={() => {
                              setMechanicSearch("");
                              setMechanicOpen(false);
                            }}
                          >
                            Tutup
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </Field>
              </div>

              <Field label="Keluhan">
                <Textarea
                  value={draft.complaint}
                  onChange={(e) => setDraft((d) => ({ ...d, complaint: e.target.value }))}
                  rows={4}
                />
              </Field>

              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Pengecekan - Sebelum">
                  <Textarea
                    value={draft.preCheck}
                    onChange={(e) => setDraft((d) => ({ ...d, preCheck: e.target.value }))}
                    rows={5}
                  />
                </Field>
                <Field label="Pengecekan - Sesudah">
                  <Textarea
                    value={draft.postCheck}
                    onChange={(e) => setDraft((d) => ({ ...d, postCheck: e.target.value }))}
                    rows={5}
                  />
                </Field>
              </div>
            </div>
          ) : null}

          {tab === "items" ? (
            <div className="grid gap-5">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">A. Jasa (Manual)</p>
                    <p className="mt-1 text-xs text-slate-600">
                      Total jasa (draft): <span className="font-semibold">{formatRupiah(jasaSubtotal)}</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() =>
                        setJasaLines((rows) => [
                          ...rows,
                          { clientId: makeClientId(), name: "", qty: "1", price: "0" },
                        ])
                      }
                    >
                      + Jasa
                    </Button>
                    <Button
                      type="button"
                      onClick={() => {
                        const payload = jasaLines
                          .map((r) => ({
                            name: r.name.trim(),
                            qty: Math.max(1, safeInt(r.qty)),
                            price: parseRupiah(r.price),
                          }))
                          .filter((r) => r.name.length > 0);

                        replaceJasaMutation.mutate({ workOrderId: woId, items: payload });
                      }}
                      disabled={replaceJasaMutation.isPending}
                    >
                      {replaceJasaMutation.isPending ? "Menyimpan..." : "Simpan Jasa"}
                    </Button>
                  </div>
                </div>

                <div className="mt-4 grid gap-2">
                  {jasaLines.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                      Belum ada jasa.
                    </div>
                  ) : (
                    jasaLines.map((row) => (
                      <div key={row.clientId} className="grid gap-2 sm:grid-cols-[1fr_120px_160px_110px]">
                        <Input
                          value={row.name}
                          onChange={(e) =>
                            setJasaLines((rows) =>
                              rows.map((r) => (r.clientId === row.clientId ? { ...r, name: e.target.value } : r)),
                            )
                          }
                          placeholder="Nama jasa"
                        />
                        <Input
                          value={row.qty}
                          onChange={(e) =>
                            setJasaLines((rows) =>
                              rows.map((r) => (r.clientId === row.clientId ? { ...r, qty: e.target.value } : r)),
                            )
                          }
                          inputMode="numeric"
                          placeholder="Qty"
                        />
                        <Input
                          value={row.price}
                          onChange={(e) =>
                            setJasaLines((rows) =>
                              rows.map((r) => (r.clientId === row.clientId ? { ...r, price: e.target.value } : r)),
                            )
                          }
                          onBlur={(e) =>
                            setJasaLines((rows) =>
                              rows.map((r) =>
                                r.clientId === row.clientId
                                  ? { ...r, price: formatRupiahInput(e.target.value) }
                                  : r,
                              ),
                            )
                          }
                          inputMode="numeric"
                          placeholder="Harga"
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => setJasaLines((rows) => rows.filter((r) => r.clientId !== row.clientId))}
                        >
                          Hapus
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-900">B. Sparepart (FIFO/HPP)</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Field label="Cari">
                      <Input
                        value={sparepartQuery}
                        onChange={(e) => setSparepartQuery(e.target.value)}
                        placeholder="Nama / brand"
                      />
                    </Field>
                    <Field label="Qty">
                      <Input
                        value={sparepartQty}
                        onChange={(e) => setSparepartQty(e.target.value)}
                        inputMode="numeric"
                      />
                    </Field>
                  </div>

                  {(() => {
                    const items = sparepartsQuery.data ?? [];
                    const brands = Array.from(
                      new Set(
                        items
                          .map((p) => (p.brand ?? "-").trim() || "-")
                          .filter((b) => b.length > 0),
                      ),
                    ).sort((a, b) => a.localeCompare(b));

                    const visibleBrands = ["Semua", ...brands];
                    const filtered =
                      sparepartBrand === "Semua"
                        ? items
                        : items.filter((p) => ((p.brand ?? "-").trim() || "-") === sparepartBrand);

                    return (
                      <div className="mt-4">
                        <div className="-mx-1 flex flex-nowrap gap-2 overflow-x-auto px-1 pb-1">
                          {visibleBrands.map((b) => (
                            <button
                              key={b}
                              type="button"
                              className={cn(
                                "whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold",
                                b === sparepartBrand
                                  ? "border-slate-900 bg-slate-900 text-white"
                                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                              )}
                              onClick={() => setSparepartBrand(b)}
                            >
                              {b}
                            </button>
                          ))}
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          {filtered.length === 0 ? (
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 sm:col-span-2">
                              Tidak ada sparepart.
                            </div>
                          ) : (
                            filtered.map((p) => (
                              <div
                                key={p.id}
                                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-slate-900">{p.name}</p>
                                    <p className="mt-1 text-xs text-slate-600">
                                      {(p.brand ?? "-").trim() || "-"} · Stok {p.stockAvailable}
                                    </p>
                                    <p className="mt-1 text-xs font-semibold text-slate-900">
                                      {formatRupiah(p.sellPrice)}
                                    </p>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    disabled={addSparepartMutation.isPending}
                                    onClick={() => {
                                      const qty = Math.max(1, safeInt(sparepartQty));
                                      if ((p.stockAvailable ?? 0) === 0) {
                                        setStockZeroConfirm({
                                          open: true,
                                          kind: "SPAREPART",
                                          productId: p.id,
                                          name: p.name,
                                          brand: p.brand,
                                          stockAvailable: p.stockAvailable ?? 0,
                                        });
                                        return;
                                      }
                                      addSparepartMutation.mutate({ workOrderId: woId, productId: p.id, qty });
                                    }}
                                  >
                                    Tambah
                                  </Button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-900">C. Oli (FIFO/HPP)</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Field label="Cari">
                      <Input
                        value={oilQuery}
                        onChange={(e) => setOilQuery(e.target.value)}
                        placeholder="Nama / brand"
                      />
                    </Field>
                    <Field label="Qty">
                      <Input
                        value={oilQty}
                        onChange={(e) => setOilQty(e.target.value)}
                        inputMode="numeric"
                      />
                    </Field>
                  </div>

                  {(() => {
                    const grouped = oilsGroupedQuery.data ?? [];
                    const brands = grouped.map((g) => g.brand).filter(Boolean);
                    const visibleBrands = ["Semua", ...brands];

                    const picked =
                      oilBrand === "Semua" ? grouped : grouped.filter((g) => g.brand === oilBrand);

                    const flattened = picked.flatMap((g) => g.items.map((it) => ({ ...it, brand: g.brand })));

                    return (
                      <div className="mt-4">
                        <div className="-mx-1 flex flex-nowrap gap-2 overflow-x-auto px-1 pb-1">
                          {visibleBrands.map((b) => (
                            <button
                              key={b}
                              type="button"
                              className={cn(
                                "whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold",
                                b === oilBrand
                                  ? "border-slate-900 bg-slate-900 text-white"
                                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                              )}
                              onClick={() => setOilBrand(b)}
                            >
                              {b}
                            </button>
                          ))}
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          {flattened.length === 0 ? (
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 sm:col-span-2">
                              Tidak ada oli.
                            </div>
                          ) : (
                            flattened.map((it) => (
                              <div
                                key={it.id}
                                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-slate-900">{it.name}</p>
                                    <p className="mt-1 text-xs text-slate-600">
                                      {it.brand} · Stok {it.stockAvailable}
                                    </p>
                                    <p className="mt-1 text-xs font-semibold text-slate-900">
                                      {formatRupiah(it.sellPrice)}
                                    </p>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    disabled={addOilMutation.isPending}
                                    onClick={() => {
                                      const qty = Math.max(1, safeInt(oilQty));
                                      if ((it.stockAvailable ?? 0) === 0) {
                                        setStockZeroConfirm({
                                          open: true,
                                          kind: "OIL",
                                          productId: it.id,
                                          name: it.name,
                                          brand: it.brand,
                                          stockAvailable: it.stockAvailable ?? 0,
                                        });
                                        return;
                                      }
                                      addOilMutation.mutate({ workOrderId: woId, productId: it.id, qty });
                                    }}
                                  >
                                    Tambah
                                  </Button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-900">Items di WO (Readonly)</p>
                <div className="mt-2 grid gap-2 text-sm text-slate-700">
                  {(woQuery.data?.items ?? []).length === 0 ? (
                    <p className="text-sm text-slate-600">Belum ada items.</p>
                  ) : (
                    (woQuery.data?.items ?? []).map((it: WorkOrderItem) => (
                      <div
                        key={it.id}
                        className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{it.name}</p>
                          <p className="text-xs text-slate-600">
                            {it.type} · Qty {it.qty} · Harga {formatRupiah(it.price)}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-slate-900">
                          {formatRupiah((it.qty ?? 0) * (it.price ?? 0))}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {tab === "payment" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="DP">
                <Input
                  value={draft.dp}
                  onChange={(e) => setDraft((d) => ({ ...d, dp: e.target.value }))}
                  onBlur={(e) => setDraft((d) => ({ ...d, dp: formatRupiahInput(e.target.value) }))}
                  inputMode="numeric"
                />
              </Field>
              <Field label="Total Dibayar">
                <Input
                  value={draft.paidAmount}
                  onChange={(e) => setDraft((d) => ({ ...d, paidAmount: e.target.value }))}
                  onBlur={(e) =>
                    setDraft((d) => ({ ...d, paidAmount: formatRupiahInput(e.target.value) }))
                  }
                  inputMode="numeric"
                />
              </Field>
              <Field label="Discount (%)">
                <Input
                  value={draft.discountPercent}
                  onChange={(e) => setDraft((d) => ({ ...d, discountPercent: e.target.value }))}
                  inputMode="numeric"
                />
              </Field>
              <Field label="Tax / PPN (%)">
                <Input
                  value={draft.taxPercent}
                  onChange={(e) => setDraft((d) => ({ ...d, taxPercent: e.target.value }))}
                  inputMode="numeric"
                />
              </Field>
              <Field label="Payment Method">
                <select
                  className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm"
                  value={draft.paymentMethod}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      paymentMethod: e.target.value === "TRANSFER" ? "TRANSFER" : "CASH",
                    }))
                  }
                >
                  <option value="CASH">Cash</option>
                  <option value="TRANSFER">Transfer</option>
                </select>
              </Field>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:col-span-2">
                <div className="grid gap-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Total (Grand Total)</span>
                    <span className="font-semibold text-slate-900">
                      {formatRupiah(woQuery.data?.grandTotal ?? 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-4 py-2 text-xs font-semibold transition-all",
        active ? "bg-slate-900 text-white" : "bg-white text-slate-700 hover:bg-slate-50",
        "border border-slate-200",
      )}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-1", className)}>
      <p className="text-xs font-semibold text-slate-700">{label}</p>
      {children}
    </div>
  );
}

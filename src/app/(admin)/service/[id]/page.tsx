"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { useDebouncedValue } from "~/hooks/use-debounced-value";
import { useToast } from "~/hooks/use-toast";
import { cn, formatRupiah, parseRupiah } from "~/lib/utils";
import { api } from "~/trpc/react";

type TabKey = "customer" | "order" | "items" | "payment";

type JasaLine = {
  clientId: string;
  name: string;
  qty: string;
  price: string;
};

type Draft = {
  id: string;
  woNumber: string;
  status: "DRAFT" | "ANTRIAN" | "PROSES" | "SELESAI" | "DIAMBIL" | "OPEN" | "DONE" | "CANCELLED";

  customerMode: "existing" | "new";
  customerId: string;
  vehicleId: string;

  newCustomer: { name: string; phone: string; address: string };
  newVehicle: { plateNumber: string; brand: string; model: string; km: string };

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
  const { toast } = useToast();
  const utils = api.useUtils();

  const params = useParams<{ id: string }>();
  const woId = params?.id ? String(params.id) : "";

  const [tab, setTab] = React.useState<TabKey>("customer");

  const [draft, setDraft] = React.useState<Draft>(() => ({
    id: woId,
    woNumber: "",
    status: "DRAFT",

    customerMode: "existing",
    customerId: "",
    vehicleId: "",

    newCustomer: { name: "", phone: "", address: "" },
    newVehicle: { plateNumber: "", brand: "", model: "", km: "" },

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

    const jasa = (wo.items ?? []).filter((it: any) => it.type === "JASA");
    setJasaLines(
      jasa.map((it: any) => ({
        clientId: makeClientId(),
        name: it.name ?? "",
        qty: String(it.qty ?? 1),
        price: formatRupiah(it.price ?? 0, { prefix: false }),
      })),
    );
  }, [woQuery.data?.updatedAt]);

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
      mechanicIds: (wo.mechanics ?? []).map((m: any) => m.userId),
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

  const onSave = React.useCallback(async () => {
    const payload: any = {
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

    if (draft.customerMode === "existing") {
      payload.customerId = draft.customerId.trim() ? draft.customerId : null;
      payload.vehicleId = draft.vehicleId.trim() ? draft.vehicleId : null;
    } else {
      payload.newCustomer = {
        name: draft.newCustomer.name,
        phone: draft.newCustomer.phone,
        address: draft.newCustomer.address || undefined,
      };
      payload.newVehicle = {
        plateNumber: draft.newVehicle.plateNumber,
        brand: draft.newVehicle.brand,
        model: draft.newVehicle.model,
        currentOdometer: draft.newVehicle.km.trim() ? safeInt(draft.newVehicle.km) : undefined,
      };
    }

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
    <Card className="border border-slate-200/70 bg-white/60 shadow-sm backdrop-blur-lg">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-slate-900">Work Order</CardTitle>
          <p className="mt-1 text-sm text-slate-600">Bisa disimpan kapan saja (draft). Edit kapan saja.</p>
        </div>
        {headerRight}
      </CardHeader>

      <CardContent className="space-y-4">
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
                      newVehicle: { plateNumber: "", brand: "", model: "", km: "" },
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

              <Field label="Mechanic (Multi)">
                <div className="flex flex-wrap gap-2">
                  {(mechanicsQuery.data ?? []).map((m) => {
                    const active = draft.mechanicIds.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs font-semibold",
                          active
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                        )}
                        onClick={() =>
                          setDraft((d) => ({
                            ...d,
                            mechanicIds: active
                              ? d.mechanicIds.filter((id) => id !== m.id)
                              : [...d.mechanicIds, m.id],
                          }))
                        }
                      >
                        {m.name ?? m.email}
                      </button>
                    );
                  })}
                </div>
              </Field>
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
                  <Field label="Pilih" className="sm:col-span-2">
                    <select
                      className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm"
                      value={sparepartId}
                      onChange={(e) => setSparepartId(e.target.value)}
                    >
                      <option value="">-</option>
                      {(sparepartsQuery.data ?? []).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} (Stok {p.stockAvailable}) ({formatRupiah(p.sellPrice)})
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <div className="mt-3">
                  <Button
                    type="button"
                    onClick={() => {
                      if (!sparepartId) {
                        toast({ variant: "destructive", title: "Sparepart wajib dipilih" });
                        return;
                      }
                      const qty = Math.max(1, safeInt(sparepartQty));
                      addSparepartMutation.mutate({ workOrderId: woId, productId: sparepartId, qty });
                    }}
                    disabled={addSparepartMutation.isPending}
                  >
                    {addSparepartMutation.isPending ? "Menambah..." : "Tambah Sparepart"}
                  </Button>
                </div>
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
                  <Field label="Pilih" className="sm:col-span-2">
                    <select
                      className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm"
                      value={oilId}
                      onChange={(e) => setOilId(e.target.value)}
                    >
                      <option value="">-</option>
                      {(oilsGroupedQuery.data ?? []).flatMap((g) =>
                        g.items.map((it) => (
                          <option key={it.id} value={it.id}>
                            {g.brand} - {it.name} (Stok {it.stockAvailable}) ({formatRupiah(it.sellPrice)})
                          </option>
                        )),
                      )}
                    </select>
                  </Field>
                </div>
                <div className="mt-3">
                  <Button
                    type="button"
                    onClick={() => {
                      if (!oilId) {
                        toast({ variant: "destructive", title: "Oli wajib dipilih" });
                        return;
                      }
                      const qty = Math.max(1, safeInt(oilQty));
                      addOilMutation.mutate({ workOrderId: woId, productId: oilId, qty });
                    }}
                    disabled={addOilMutation.isPending}
                  >
                    {addOilMutation.isPending ? "Menambah..." : "Tambah Oli"}
                  </Button>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-900">Items di WO (Readonly)</p>
                <div className="mt-2 grid gap-2 text-sm text-slate-700">
                  {(woQuery.data?.items ?? []).length === 0 ? (
                    <p className="text-sm text-slate-600">Belum ada items.</p>
                  ) : (
                    (woQuery.data?.items ?? []).map((it: any) => (
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
      </CardContent>
    </Card>
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

"use client";

import * as React from "react";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
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

type TabKey = "customer" | "order" | "items" | "payment";

type DraftItemType = "JASA" | "SPAREPART" | "OLI";

type DraftItem = {
  clientId: string;
  type: DraftItemType;
  name: string;
  qty: number;
  price: number;
  sparepartId?: string;
  oilId?: string;
};

type CustomerMode = "existing" | "new";

type Draft = {
  id?: string;
  woNumber: string;
  dateTime: string;

  customerMode: CustomerMode;
  customerId?: string;
  vehicleId?: string;

  newCustomer: {
    name: string;
    phone: string;
    address: string;
  };

  newVehicle: {
    plateNumber: string;
    brand: string;
    model: string;
    km: string;
  };

  odo: string;
  complaint: string;

  advisorId: string;
  mechanicIds: string[];

  preCheck: string;
  postCheck: string;
  estimatedDoneAt: string;
  reminderNextOdo: string;
  reminderNextDate: string;

  items: DraftItem[];

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

function money(n: number) {
  return new Intl.NumberFormat("id-ID").format(n);
}

function computeSubtotal(items: DraftItem[]) {
  return items.reduce((acc, it) => acc + it.qty * it.price, 0);
}

function computeGrandTotal(params: {
  subtotal: number;
  discountPercent: number;
  taxPercent: number;
}) {
  const discountAmount = Math.floor((params.subtotal * params.discountPercent) / 100);
  const afterDiscount = Math.max(0, params.subtotal - discountAmount);
  const taxAmount = Math.floor((afterDiscount * params.taxPercent) / 100);
  return afterDiscount + taxAmount;
}

function makeClientId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random()}`;
}

function isDefined<T>(v: T): v is NonNullable<T> {
  return v !== null && v !== undefined;
}

function formatVehicleLabel(v: { plateNumber: string; brand: string; model: string }) {
  return `${v.plateNumber} - ${v.brand} ${v.model}`;
}

export default function ServicePage() {
  const { toast } = useToast();
  const utils = api.useUtils();

  const [tab, setTab] = React.useState<TabKey>("customer");
  const [selectedWoId, setSelectedWoId] = React.useState<string | null>(null);

  const [draft, setDraft] = React.useState<Draft>(() => ({
    woNumber: "",
    dateTime: nowLocalInputValue(),

    customerMode: "existing",
    customerId: undefined,
    vehicleId: undefined,

    newCustomer: { name: "", phone: "", address: "" },
    newVehicle: { plateNumber: "", brand: "", model: "", km: "" },

    odo: "",
    complaint: "",

    advisorId: "",
    mechanicIds: [],

    preCheck: "",
    postCheck: "",
    estimatedDoneAt: "",
    reminderNextOdo: "",
    reminderNextDate: "",

    items: [],

    dp: "0",
    discountPercent: "0",
    taxPercent: "0",
    paidAmount: "0",
    paymentMethod: "CASH",
  }));

  const nextWo = api.service.getNextWoNumber.useQuery(undefined, {
    staleTime: 60_000,
  });

  React.useEffect(() => {
    if (!draft.woNumber && nextWo.data?.woNumber) {
      setDraft((d) => ({ ...d, woNumber: nextWo.data.woNumber }));
    }
  }, [draft.woNumber, nextWo.data?.woNumber]);

  const mechanicsQuery = api.service.listMechanics.useQuery(undefined, {
    staleTime: 60_000,
  });
  const advisorsQuery = api.service.listAdvisors.useQuery(undefined, {
    staleTime: 60_000,
  });

  const [customerQuery, setCustomerQuery] = React.useState("");
  const debouncedCustomerQuery = useDebouncedValue(customerQuery, 250);

  const customerSearch = api.service.searchCustomers.useQuery(
    { query: debouncedCustomerQuery, limit: 10 },
    { enabled: draft.customerMode === "existing" && debouncedCustomerQuery.trim().length >= 2 },
  );

  const vehiclesQuery = api.service.listVehiclesByCustomer.useQuery(
    { customerId: draft.customerId ?? "" },
    { enabled: draft.customerMode === "existing" && Boolean(draft.customerId) },
  );

  const [woSearchQuery, setWoSearchQuery] = React.useState("");
  const debouncedWoSearchQuery = useDebouncedValue(woSearchQuery, 250);

  const woList = api.service.searchWorkOrders.useQuery(
    { page: 1, limit: 10, query: debouncedWoSearchQuery.trim() ? debouncedWoSearchQuery : undefined },
    { staleTime: 10_000 },
  );

  const recent = api.service.recent.useQuery(
    { limit: 10 },
    { staleTime: 10_000 },
  );

  const woDetails = api.service.getById.useQuery(
    { id: selectedWoId ?? "" },
    { enabled: Boolean(selectedWoId) },
  );

  React.useEffect(() => {
    const wo = woDetails.data;
    if (!wo) return;

    setDraft((d) => ({
      ...d,
      id: wo.id,
      woNumber: wo.woNumber,
      dateTime: new Date(wo.createdAt).toISOString().slice(0, 16),

      customerMode: "existing",
      customerId: wo.customerId,
      vehicleId: wo.vehicleId,

      newCustomer: { name: "", phone: "", address: "" },
      newVehicle: { plateNumber: "", brand: "", model: "", km: "" },

      odo: wo.odo ? String(wo.odo) : "",
      complaint: wo.complaint ?? "",

      advisorId: wo.advisorId ?? "",
      mechanicIds: wo.mechanics.map((m) => m.userId),

      preCheck: wo.preCheck ?? "",
      postCheck: wo.postCheck ?? "",
      estimatedDoneAt: wo.estimatedDoneAt
        ? new Date(wo.estimatedDoneAt).toISOString().slice(0, 16)
        : "",
      reminderNextOdo: wo.reminderNextOdo ? String(wo.reminderNextOdo) : "",
      reminderNextDate: wo.reminderNextDate
        ? new Date(wo.reminderNextDate).toISOString().slice(0, 10)
        : "",

      items: wo.items.map((it) => ({
        clientId: makeClientId(),
        type: it.type,
        name: it.name,
        qty: it.qty,
        price: it.price,
        sparepartId: it.sparepartId ?? undefined,
        oilId: it.oilId ?? undefined,
      })),

      dp: String(wo.dp),
      discountPercent: String(wo.discountPercent),
      taxPercent: String(wo.taxPercent),
      paidAmount: String(wo.paidAmount),
      paymentMethod: wo.paymentMethod,
    }));
  }, [woDetails.data]);

  const [sparepartQuery, setSparepartQuery] = React.useState("");
  const debouncedSparepartQuery = useDebouncedValue(sparepartQuery, 200);

  const spareparts = api.service.listSpareparts.useQuery(
    {
      query: debouncedSparepartQuery.trim() ? debouncedSparepartQuery : undefined,
      limit: 20,
    },
    { staleTime: 60_000 },
  );

  const [oilQuery, setOilQuery] = React.useState("");
  const debouncedOilQuery = useDebouncedValue(oilQuery, 200);

  const oilsGrouped = api.service.listOilsGrouped.useQuery(
    { query: debouncedOilQuery.trim() ? debouncedOilQuery : undefined, limit: 100 },
    { staleTime: 60_000 },
  );

  const subtotal = React.useMemo(() => computeSubtotal(draft.items), [draft.items]);
  const grandTotal = React.useMemo(() => {
    return computeGrandTotal({
      subtotal,
      discountPercent: safeInt(draft.discountPercent),
      taxPercent: safeInt(draft.taxPercent),
    });
  }, [draft.discountPercent, draft.taxPercent, subtotal]);

  const paidAmount = safeInt(draft.paidAmount);
  const changeAmount = Math.max(0, paidAmount - grandTotal);

  const upsertMutation = api.service.upsert.useMutation({
    onSuccess: async (res) => {
      toast({ variant: "success", title: "WO tersimpan" });
      setSelectedWoId(res.id);
      setDraft((d) => ({ ...d, id: res.id }));
      await Promise.all([
        utils.service.searchWorkOrders.invalidate(),
        utils.service.recent.invalidate(),
      ]);
    },
    onError: (e) => {
      toast({
        variant: "destructive",
        title: "Gagal menyimpan WO",
        description: e.message,
      });
    },
  });

  const printRef = React.useRef<HTMLDivElement>(null);

  const onPrint = React.useCallback(() => {
    if (!draft.woNumber) return;
    window.print();
  }, [draft.woNumber]);

  const resetNewWo = React.useCallback(async () => {
    setSelectedWoId(null);
    setDraft((d) => ({
      ...d,
      id: undefined,
      woNumber: nextWo.data?.woNumber ?? "",
      dateTime: nowLocalInputValue(),
      customerMode: "existing",
      customerId: undefined,
      vehicleId: undefined,
      newCustomer: { name: "", phone: "", address: "" },
      newVehicle: { plateNumber: "", brand: "", model: "", km: "" },
      odo: "",
      complaint: "",
      advisorId: "",
      mechanicIds: [],
      preCheck: "",
      postCheck: "",
      estimatedDoneAt: "",
      reminderNextOdo: "",
      reminderNextDate: "",
      items: [],
      dp: "0",
      discountPercent: "0",
      taxPercent: "0",
      paidAmount: "0",
      paymentMethod: "CASH",
    }));

    await utils.service.getNextWoNumber.invalidate();
  }, [nextWo.data?.woNumber, utils.service.getNextWoNumber]);

  const onSave = React.useCallback(async () => {
    if (!draft.woNumber.trim()) {
      toast({ variant: "destructive", title: "WO number belum tersedia" });
      return;
    }

    const mechanicIds = draft.mechanicIds;

    const isNewCustomer = draft.customerMode === "new";

    await upsertMutation.mutateAsync({
      id: draft.id,
      woNumber: draft.woNumber,
      dateTime: new Date(draft.dateTime).toISOString(),

      customerId: !isNewCustomer ? draft.customerId : undefined,
      vehicleId: !isNewCustomer ? draft.vehicleId : undefined,
      newCustomer: isNewCustomer
        ? {
            name: draft.newCustomer.name,
            phone: draft.newCustomer.phone,
            address: draft.newCustomer.address.trim() ? draft.newCustomer.address : undefined,
          }
        : undefined,
      newVehicle: isNewCustomer
        ? {
            plateNumber: draft.newVehicle.plateNumber,
            brand: draft.newVehicle.brand,
            model: draft.newVehicle.model,
            currentOdometer: draft.newVehicle.km.trim()
              ? safeInt(draft.newVehicle.km)
              : undefined,
          }
        : undefined,

      odo: draft.odo.trim() ? safeInt(draft.odo) : undefined,
      complaint: draft.complaint.trim() ? draft.complaint : undefined,

      advisorId: draft.advisorId.trim() ? draft.advisorId : undefined,
      mechanicIds,

      items: draft.items.map((it) => ({
        type: it.type,
        name: it.name,
        qty: it.qty,
        price: it.price,
        sparepartId: it.sparepartId,
        oilId: it.oilId,
      })),

      preCheck: draft.preCheck.trim() ? draft.preCheck : undefined,
      postCheck: draft.postCheck.trim() ? draft.postCheck : undefined,
      estimatedDoneAt: draft.estimatedDoneAt.trim()
        ? new Date(draft.estimatedDoneAt).toISOString()
        : undefined,
      reminderNextOdo: draft.reminderNextOdo.trim() ? safeInt(draft.reminderNextOdo) : undefined,
      reminderNextDate: draft.reminderNextDate.trim()
        ? new Date(draft.reminderNextDate).toISOString()
        : undefined,

      dp: safeInt(draft.dp),
      discountPercent: safeInt(draft.discountPercent),
      taxPercent: safeInt(draft.taxPercent),
      paidAmount: safeInt(draft.paidAmount),
      paymentMethod: draft.paymentMethod,
    });
  }, [draft, toast, upsertMutation]);

  const moveNext = React.useCallback(() => {
    const order: TabKey[] = ["customer", "order", "items", "payment"];
    const idx = order.indexOf(tab);
    const next = order.at(idx + 1);
    if (next) setTab(next);
  }, [tab]);

  const onToggleMechanic = React.useCallback((id: string) => {
    setDraft((d) => {
      const exists = d.mechanicIds.includes(id);
      return {
        ...d,
        mechanicIds: exists ? d.mechanicIds.filter((x) => x !== id) : [...d.mechanicIds, id],
      };
    });
  }, []);

  const selectedMechanics = React.useMemo(() => {
    const list = mechanicsQuery.data ?? [];
    const map = new Map(list.map((m) => [m.id, m] as const));
    return draft.mechanicIds
      .map((id) => map.get(id))
      .filter(isDefined);
  }, [draft.mechanicIds, mechanicsQuery.data]);

  const [jasaName, setJasaName] = React.useState("");
  const [jasaPrice, setJasaPrice] = React.useState("");
  const [jasaQty, setJasaQty] = React.useState("1");

  const [sparepartId, setSparepartId] = React.useState("");
  const [sparepartQty, setSparepartQty] = React.useState("1");

  const [oilId, setOilId] = React.useState("");
  const [oilQty, setOilQty] = React.useState("1");

  const sparepartById = React.useMemo(() => {
    const items = spareparts.data ?? [];
    return new Map(items.map((p) => [p.id, p] as const));
  }, [spareparts.data]);

  const oilById = React.useMemo(() => {
    const groups = oilsGrouped.data ?? [];
    const entries: Array<[string, { id: string; name: string; price: number; brand: string }]> = [];
    for (const g of groups) {
      for (const it of g.items) {
        entries.push([it.id, { ...it, brand: g.brand }]);
      }
    }
    return new Map(entries);
  }, [oilsGrouped.data]);

  const addItem = React.useCallback((item: Omit<DraftItem, "clientId">) => {
    setDraft((d) => ({
      ...d,
      items: [...d.items, { ...item, clientId: makeClientId() }],
    }));
  }, []);

  const onAddJasa = React.useCallback(() => {
    const name = jasaName.trim();
    const qty = safeInt(jasaQty);
    const price = safeInt(jasaPrice);

    if (!name) {
      toast({ variant: "destructive", title: "Nama jasa wajib diisi" });
      return;
    }
    if (qty <= 0) {
      toast({ variant: "destructive", title: "Qty tidak valid" });
      return;
    }

    addItem({ type: "JASA", name, qty, price });
    setJasaName("");
    setJasaPrice("");
    setJasaQty("1");
  }, [addItem, jasaName, jasaPrice, jasaQty, toast]);

  const onAddSparepart = React.useCallback(() => {
    const sp = sparepartById.get(sparepartId);
    const qty = safeInt(sparepartQty);

    if (!sp) {
      toast({ variant: "destructive", title: "Sparepart wajib dipilih" });
      return;
    }

    addItem({
      type: "SPAREPART",
      name: `${sp.brand} ${sp.name}`.trim(),
      qty,
      price: sp.price,
      sparepartId: sp.id,
    });

    setSparepartId("");
    setSparepartQty("1");
  }, [addItem, sparepartById, sparepartId, sparepartQty, toast]);

  const onAddOil = React.useCallback(() => {
    const oil = oilById.get(oilId);
    const qty = safeInt(oilQty);

    if (!oil) {
      toast({ variant: "destructive", title: "Oli wajib dipilih" });
      return;
    }

    addItem({
      type: "OLI",
      name: `${oil.brand} ${oil.name}`.trim(),
      qty,
      price: oil.price,
      oilId: oil.id,
    });

    setOilId("");
    setOilQty("1");
  }, [addItem, oilById, oilId, oilQty, toast]);

  const updateItem = React.useCallback((clientId: string, patch: Partial<DraftItem>) => {
    setDraft((d) => ({
      ...d,
      items: d.items.map((it) => (it.clientId === clientId ? { ...it, ...patch } : it)),
    }));
  }, []);

  const removeItem = React.useCallback((clientId: string) => {
    setDraft((d) => ({
      ...d,
      items: d.items.filter((it) => it.clientId !== clientId),
    }));
  }, []);

  const titlePlate = React.useMemo(() => {
    if (draft.customerMode === "new") return draft.newVehicle.plateNumber.trim();
    const vehicle = vehiclesQuery.data?.find((v) => v.id === draft.vehicleId);
    return vehicle?.plateNumber ?? "";
  }, [draft.customerMode, draft.newVehicle.plateNumber, draft.vehicleId, vehiclesQuery.data]);

  return (
    <div className="grid gap-4">
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
          body {
            background: white !important;
          }
        }
      `}</style>

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <div className="no-print">
          <Card className="border border-slate-200/70 bg-white/60 shadow-sm backdrop-blur-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-slate-900">Work Order</CardTitle>
              <div className="mt-2 grid gap-1">
                <p className="text-xs text-slate-500">WO</p>
                <p className="text-lg font-semibold text-slate-900">{draft.woNumber || "-"}</p>
                <p className="text-xs text-slate-600">
                  Plat: <span className="font-semibold text-slate-900">{titlePlate || "-"}</span>
                </p>
                <p className="text-xs text-slate-600">
                  Total: <span className="font-semibold text-slate-900">Rp {money(grandTotal)}</span>
                </p>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="secondary" type="button" onClick={() => void resetNewWo()}>
                  WO Baru
                </Button>
                <Button variant="secondary" type="button" onClick={onPrint}>
                  Print
                </Button>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <p className="text-xs font-semibold text-slate-700">Cari / Buka WO</p>
                <Input
                  value={woSearchQuery}
                  onChange={(e) => setWoSearchQuery(e.target.value)}
                  placeholder="Cari WO / plat / nama / telp"
                />
                <div className="max-h-[260px] overflow-y-auto rounded-2xl border border-slate-200 bg-white">
                  <div className="p-2">
                    {(woList.data?.items ?? recent.data ?? []).map((wo) => (
                      <button
                        key={wo.id}
                        type="button"
                        className={cn(
                          "w-full rounded-xl border px-3 py-2 text-left transition-all",
                          "hover:bg-slate-50",
                          selectedWoId === wo.id
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-900",
                        )}
                        onClick={() => setSelectedWoId(wo.id)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold">{wo.woNumber}</p>
                          <p className={cn("text-xs", selectedWoId === wo.id ? "text-white/80" : "text-slate-500")}>
                            Rp {money(wo.grandTotal)}
                          </p>
                        </div>
                        <p className={cn("mt-1 text-xs", selectedWoId === wo.id ? "text-white/80" : "text-slate-600")}>
                          {wo.customer.name} · {wo.vehicle.plateNumber}
                        </p>
                      </button>
                    ))}
                    {woList.isFetching || recent.isFetching ? (
                      <p className="mt-2 text-xs text-slate-500">Loading...</p>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="grid gap-2">
                <p className="text-xs font-semibold text-slate-700">Quick totals</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-2xl border border-slate-200 bg-white p-3">
                    <p className="text-xs text-slate-500">Subtotal</p>
                    <p className="text-sm font-semibold text-slate-900">Rp {money(subtotal)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-3">
                    <p className="text-xs text-slate-500">Items</p>
                    <p className="text-sm font-semibold text-slate-900">{draft.items.length}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4">
          <div className="no-print">
            <Card className="border border-slate-200/70 bg-white/60 shadow-sm backdrop-blur-lg">
              <CardHeader className="pb-2">
                <div className="flex flex-wrap gap-2">
                  <TabButton active={tab === "customer"} onClick={() => setTab("customer")}>
                    Customer Info
                  </TabButton>
                  <TabButton active={tab === "order"} onClick={() => setTab("order")}>
                    Order Info
                  </TabButton>
                  <TabButton active={tab === "items"} onClick={() => setTab("items")}>
                    Items
                  </TabButton>
                  <TabButton active={tab === "payment"} onClick={() => setTab("payment")}>
                    Payment
                  </TabButton>
                </div>
              </CardHeader>
              <CardContent>
                {tab === "customer" ? (
                  <div className="grid gap-4">
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
                        Customer Existing
                      </Button>
                      <Button
                        type="button"
                        variant={draft.customerMode === "new" ? "default" : "secondary"}
                        onClick={() =>
                          setDraft((d) => ({
                            ...d,
                            customerMode: "new",
                            customerId: undefined,
                            vehicleId: undefined,
                          }))
                        }
                      >
                        Customer Baru
                      </Button>
                    </div>

                    {draft.customerMode === "existing" ? (
                      <div className="grid gap-4">
                        <div className="grid gap-2">
                          <p className="text-xs font-semibold text-slate-700">Cari Customer</p>
                          <Input
                            value={customerQuery}
                            onChange={(e) => setCustomerQuery(e.target.value)}
                            placeholder="Nama / nomor telepon"
                          />

                          {customerSearch.data ? (
                            <div className="max-h-[200px] overflow-y-auto rounded-2xl border border-slate-200 bg-white">
                              <div className="p-2">
                                {customerSearch.data.map((c) => (
                                  <button
                                    key={c.id}
                                    type="button"
                                    className={cn(
                                      "w-full rounded-xl border px-3 py-2 text-left transition-all",
                                      "hover:bg-slate-50",
                                      draft.customerId === c.id
                                        ? "border-slate-900 bg-slate-900 text-white"
                                        : "border-slate-200 bg-white text-slate-900",
                                    )}
                                    onClick={() => {
                                      setDraft((d) => ({
                                        ...d,
                                        customerId: c.id,
                                        vehicleId: undefined,
                                      }));
                                    }}
                                  >
                                    <p className="text-xs font-semibold">{c.name}</p>
                                    <p className={cn("text-xs", draft.customerId === c.id ? "text-white/80" : "text-slate-600")}>
                                      {c.phone}
                                    </p>
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          {customerSearch.isFetching ? (
                            <p className="text-xs text-slate-500">Loading...</p>
                          ) : null}
                        </div>

                        <div className="grid gap-2">
                          <p className="text-xs font-semibold text-slate-700">Pilih Kendaraan</p>
                          <select
                            className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                            value={draft.vehicleId ?? ""}
                            onChange={(e) =>
                              setDraft((d) => ({ ...d, vehicleId: e.target.value || undefined }))
                            }
                            disabled={!draft.customerId || vehiclesQuery.isFetching}
                          >
                            <option value="">Pilih kendaraan</option>
                            {(vehiclesQuery.data ?? []).map((v) => (
                              <option key={v.id} value={v.id}>
                                {formatVehicleLabel({
                                  plateNumber: v.plateNumber,
                                  brand: v.brand,
                                  model: v.model,
                                })}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ) : (
                      <div className="grid gap-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label="Name">
                            <Input
                              value={draft.newCustomer.name}
                              onChange={(e) =>
                                setDraft((d) => ({
                                  ...d,
                                  newCustomer: { ...d.newCustomer, name: e.target.value },
                                }))
                              }
                              placeholder="Nama customer"
                            />
                          </Field>
                          <Field label="Phone">
                            <Input
                              value={draft.newCustomer.phone}
                              onChange={(e) =>
                                setDraft((d) => ({
                                  ...d,
                                  newCustomer: { ...d.newCustomer, phone: e.target.value },
                                }))
                              }
                              placeholder="Nomor telepon"
                            />
                          </Field>
                          <Field label="Address" className="sm:col-span-2">
                            <Textarea
                              value={draft.newCustomer.address}
                              onChange={(e) =>
                                setDraft((d) => ({
                                  ...d,
                                  newCustomer: { ...d.newCustomer, address: e.target.value },
                                }))
                              }
                              placeholder="Alamat"
                            />
                          </Field>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label="Plate Number">
                            <Input
                              value={draft.newVehicle.plateNumber}
                              onChange={(e) =>
                                setDraft((d) => ({
                                  ...d,
                                  newVehicle: { ...d.newVehicle, plateNumber: e.target.value },
                                }))
                              }
                              placeholder="B 1234 ABC"
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
                              placeholder="12345"
                              inputMode="numeric"
                            />
                          </Field>
                          <Field label="Brand">
                            <Input
                              value={draft.newVehicle.brand}
                              onChange={(e) =>
                                setDraft((d) => ({
                                  ...d,
                                  newVehicle: { ...d.newVehicle, brand: e.target.value },
                                }))
                              }
                              placeholder="Toyota"
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
                              placeholder="Avanza"
                            />
                          </Field>
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}

                {tab === "order" ? (
                  <div className="grid gap-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="WO Number">
                        <Input
                          value={draft.woNumber}
                          onChange={(e) => setDraft((d) => ({ ...d, woNumber: e.target.value }))}
                        />
                      </Field>
                      <Field label="Date & Time">
                        <Input
                          type="datetime-local"
                          value={draft.dateTime}
                          onChange={(e) => setDraft((d) => ({ ...d, dateTime: e.target.value }))}
                        />
                      </Field>
                      <Field label="KM / Odo">
                        <Input
                          value={draft.odo}
                          onChange={(e) => setDraft((d) => ({ ...d, odo: e.target.value }))}
                          inputMode="numeric"
                        />
                      </Field>
                      <Field label="Complaint" className="sm:col-span-2">
                        <Textarea
                          value={draft.complaint}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, complaint: e.target.value }))
                          }
                          placeholder="Keluhan customer"
                        />
                      </Field>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Service Advisor">
                        <select
                          className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm"
                          value={draft.advisorId}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, advisorId: e.target.value }))
                          }
                        >
                          <option value="">Pilih advisor</option>
                          {(advisorsQuery.data ?? []).map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name ?? u.email}
                            </option>
                          ))}
                        </select>
                      </Field>

                      <Field label="Mechanics (multi)">
                        <div className="grid gap-2">
                          <div className="max-h-[160px] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2">
                            {(mechanicsQuery.data ?? []).map((m) => {
                              const active = draft.mechanicIds.includes(m.id);
                              return (
                                <button
                                  key={m.id}
                                  type="button"
                                  className={cn(
                                    "w-full rounded-xl border px-3 py-2 text-left text-xs transition-all",
                                    "hover:bg-slate-50",
                                    active
                                      ? "border-slate-900 bg-slate-900 text-white"
                                      : "border-slate-200 bg-white text-slate-900",
                                  )}
                                  onClick={() => onToggleMechanic(m.id)}
                                >
                                  {m.name ?? m.email}
                                </button>
                              );
                            })}
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {selectedMechanics.map((m) => (
                              <Tag
                                key={m.id}
                                label={m.name ?? m.email}
                                onRemove={() => onToggleMechanic(m.id)}
                              />
                            ))}
                          </div>
                        </div>
                      </Field>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Pengecekan Sebelum" className="sm:col-span-2">
                        <Textarea
                          value={draft.preCheck}
                          onChange={(e) => setDraft((d) => ({ ...d, preCheck: e.target.value }))}
                          placeholder="Contoh: cek rem, cek oli, cek ban"
                        />
                      </Field>
                      <Field label="Pengecekan Sesudah" className="sm:col-span-2">
                        <Textarea
                          value={draft.postCheck}
                          onChange={(e) => setDraft((d) => ({ ...d, postCheck: e.target.value }))}
                          placeholder="Hasil setelah service"
                        />
                      </Field>
                      <Field label="Estimasi selesai">
                        <Input
                          type="datetime-local"
                          value={draft.estimatedDoneAt}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, estimatedDoneAt: e.target.value }))
                          }
                        />
                      </Field>
                      <Field label="Reminder KM berikutnya">
                        <Input
                          value={draft.reminderNextOdo}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, reminderNextOdo: e.target.value }))
                          }
                          inputMode="numeric"
                        />
                      </Field>
                      <Field label="Reminder tanggal berikutnya" className="sm:col-span-2">
                        <Input
                          type="date"
                          value={draft.reminderNextDate}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, reminderNextDate: e.target.value }))
                          }
                        />
                      </Field>
                    </div>
                  </div>
                ) : null}

                {tab === "items" ? (
                  <div className="grid gap-6">
                    <div className="grid gap-4">
                      <p className="text-sm font-semibold text-slate-900">A. Jasa (Manual)</p>
                      <div className="grid gap-3 sm:grid-cols-4">
                        <Field label="Nama" className="sm:col-span-2">
                          <Input
                            value={jasaName}
                            onChange={(e) => setJasaName(e.target.value)}
                            placeholder="Jasa service"
                          />
                        </Field>
                        <Field label="Harga">
                          <Input
                            value={jasaPrice}
                            onChange={(e) => setJasaPrice(e.target.value)}
                            placeholder="0"
                            inputMode="numeric"
                          />
                        </Field>
                        <Field label="Qty">
                          <Input
                            value={jasaQty}
                            onChange={(e) => setJasaQty(e.target.value)}
                            inputMode="numeric"
                          />
                        </Field>
                      </div>
                      <div>
                        <Button type="button" onClick={onAddJasa}>
                          Tambah Jasa
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-4">
                      <p className="text-sm font-semibold text-slate-900">B. Sparepart</p>
                      <div className="grid gap-3 sm:grid-cols-4">
                        <Field label="Cari" className="sm:col-span-2">
                          <Input
                            value={sparepartQuery}
                            onChange={(e) => setSparepartQuery(e.target.value)}
                            placeholder="Cari nama / brand"
                          />
                        </Field>
                        <Field label="Qty">
                          <Input
                            value={sparepartQty}
                            onChange={(e) => setSparepartQty(e.target.value)}
                            inputMode="numeric"
                          />
                        </Field>
                        <Field label="Pilih" className="sm:col-span-4">
                          <select
                            className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm"
                            value={sparepartId}
                            onChange={(e) => setSparepartId(e.target.value)}
                          >
                            <option value="">Pilih sparepart</option>
                            {(spareparts.data ?? []).map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.brand} - {p.name} (Rp {money(p.price)})
                              </option>
                            ))}
                          </select>
                        </Field>
                      </div>
                      <div>
                        <Button type="button" onClick={onAddSparepart}>
                          Tambah Sparepart
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-4">
                      <p className="text-sm font-semibold text-slate-900">C. Oli</p>
                      <div className="grid gap-3 sm:grid-cols-4">
                        <Field label="Cari" className="sm:col-span-2">
                          <Input
                            value={oilQuery}
                            onChange={(e) => setOilQuery(e.target.value)}
                            placeholder="Cari nama / brand"
                          />
                        </Field>
                        <Field label="Qty">
                          <Input
                            value={oilQty}
                            onChange={(e) => setOilQty(e.target.value)}
                            inputMode="numeric"
                          />
                        </Field>
                        <Field label="Pilih" className="sm:col-span-4">
                          <select
                            className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm"
                            value={oilId}
                            onChange={(e) => setOilId(e.target.value)}
                          >
                            <option value="">Pilih oli</option>
                            {(oilsGrouped.data ?? []).map((g) => (
                              <optgroup key={g.brand} label={g.brand}>
                                {g.items.map((it) => (
                                  <option key={it.id} value={it.id}>
                                    {it.name} (Rp {money(it.price)})
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                        </Field>
                      </div>
                      <div>
                        <Button type="button" onClick={onAddOil}>
                          Tambah Oli
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900">Items List</p>
                        <div className="text-xs text-slate-600">
                          Subtotal: <span className="font-semibold">Rp {money(subtotal)}</span>
                        </div>
                      </div>

                      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Type</TableHead>
                              <TableHead>Item</TableHead>
                              <TableHead className="w-[110px]">Qty</TableHead>
                              <TableHead className="w-[140px]">Price</TableHead>
                              <TableHead className="w-[160px]">Total</TableHead>
                              <TableHead className="w-[80px]"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {draft.items.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={6}>
                                  <p className="py-6 text-center text-sm text-slate-500">
                                    Belum ada item
                                  </p>
                                </TableCell>
                              </TableRow>
                            ) : (
                              draft.items.map((it) => (
                                <TableRow key={it.clientId}>
                                  <TableCell className="text-xs font-semibold">
                                    {it.type}
                                  </TableCell>
                                  <TableCell>
                                    <p className="text-sm font-medium text-slate-900">
                                      {it.name}
                                    </p>
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      value={String(it.qty)}
                                      onChange={(e) =>
                                        updateItem(it.clientId, { qty: safeInt(e.target.value) })
                                      }
                                      inputMode="numeric"
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      value={String(it.price)}
                                      onChange={(e) =>
                                        updateItem(it.clientId, {
                                          price: safeInt(e.target.value),
                                        })
                                      }
                                      inputMode="numeric"
                                    />
                                  </TableCell>
                                  <TableCell className="text-sm font-semibold text-slate-900">
                                    Rp {money(it.qty * it.price)}
                                  </TableCell>
                                  <TableCell>
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      onClick={() => removeItem(it.clientId)}
                                    >
                                      Hapus
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </div>
                ) : null}

                {tab === "payment" ? (
                  <div className="grid gap-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="DP">
                        <Input
                          value={draft.dp}
                          onChange={(e) => setDraft((d) => ({ ...d, dp: e.target.value }))}
                          inputMode="numeric"
                        />
                      </Field>
                      <Field label="Discount (%)">
                        <Input
                          value={draft.discountPercent}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, discountPercent: e.target.value }))
                          }
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
                      <Field label="Total Dibayar">
                        <Input
                          value={draft.paidAmount}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, paidAmount: e.target.value }))
                          }
                          inputMode="numeric"
                        />
                      </Field>

                      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:col-span-2">
                        <div className="grid gap-2 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-600">Subtotal</span>
                            <span className="font-semibold text-slate-900">Rp {money(subtotal)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-600">Grand Total</span>
                            <span className="font-semibold text-slate-900">Rp {money(grandTotal)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-600">Kembalian</span>
                            <span className="font-semibold text-slate-900">Rp {money(changeAmount)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <div className="no-print sticky bottom-0 z-20">
            <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-3 shadow-sm backdrop-blur-lg">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-slate-600">
                  Total: <span className="font-semibold text-slate-900">Rp {money(grandTotal)}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={() => void onSave()} disabled={upsertMutation.isPending}>
                    {draft.id ? "Update WO" : "Simpan WO"}
                  </Button>
                  <Button type="button" variant="secondary" onClick={onPrint}>
                    Print WO
                  </Button>
                  <Button type="button" variant="secondary" onClick={moveNext}>
                    Next
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div ref={printRef} className="print-only hidden">
            <PrintLayout
              woNumber={draft.woNumber}
              dateTime={draft.dateTime}
              customerMode={draft.customerMode}
              customerId={draft.customerId}
              vehicleId={draft.vehicleId}
              newCustomer={draft.newCustomer}
              newVehicle={draft.newVehicle}
              vehicles={vehiclesQuery.data ?? []}
              customers={customerSearch.data ?? []}
              advisorId={draft.advisorId}
              advisorOptions={advisorsQuery.data ?? []}
              mechanicOptions={mechanicsQuery.data ?? []}
              mechanicIds={draft.mechanicIds}
              items={draft.items}
              subtotal={subtotal}
              grandTotal={grandTotal}
              discountPercent={safeInt(draft.discountPercent)}
              taxPercent={safeInt(draft.taxPercent)}
              dp={safeInt(draft.dp)}
              paidAmount={paidAmount}
              changeAmount={changeAmount}
            />
          </div>
        </div>
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

function Tag({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
      {label}
      <button
        type="button"
        className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-700"
        onClick={onRemove}
        aria-label="Remove"
      >
        x
      </button>
    </span>
  );
}

function PrintLayout(props: {
  woNumber: string;
  dateTime: string;
  customerMode: CustomerMode;
  customerId?: string;
  vehicleId?: string;
  newCustomer: { name: string; phone: string; address: string };
  newVehicle: { plateNumber: string; brand: string; model: string; km: string };
  vehicles: Array<{
    id: string;
    plateNumber: string;
    brand: string;
    model: string;
    currentOdometer: number | null;
  }>;
  customers: Array<{ id: string; name: string; phone: string; address: string | null }>;
  advisorId: string;
  advisorOptions: Array<{ id: string; name: string | null; email: string }>;
  mechanicOptions: Array<{ id: string; name: string | null; email: string }>;
  mechanicIds: string[];
  items: DraftItem[];
  subtotal: number;
  grandTotal: number;
  discountPercent: number;
  taxPercent: number;
  dp: number;
  paidAmount: number;
  changeAmount: number;
}) {
  const vehicle = props.vehicles.find((v) => v.id === props.vehicleId);

  const customer = props.customers.find((c) => c.id === props.customerId);

  const displayCustomer =
    props.customerMode === "new"
      ? {
          name: props.newCustomer.name,
          phone: props.newCustomer.phone,
          address: props.newCustomer.address,
        }
      : {
          name: customer?.name ?? "",
          phone: customer?.phone ?? "",
          address: customer?.address ?? "",
        };

  const displayVehicle =
    props.customerMode === "new"
      ? {
          plateNumber: props.newVehicle.plateNumber,
          brand: props.newVehicle.brand,
          model: props.newVehicle.model,
          km: props.newVehicle.km,
        }
      : {
          plateNumber: vehicle?.plateNumber ?? "",
          brand: vehicle?.brand ?? "",
          model: vehicle?.model ?? "",
          km:
            vehicle?.currentOdometer !== null && vehicle?.currentOdometer !== undefined
              ? String(vehicle.currentOdometer)
              : "",
        };

  const advisor = props.advisorOptions.find((u) => u.id === props.advisorId);

  const mechanicMap = new Map(props.mechanicOptions.map((m) => [m.id, m] as const));
  const mechanicNames = props.mechanicIds
    .map((id) => mechanicMap.get(id))
    .filter(isDefined)
    .map((m) => m.name ?? m.email);

  return (
    <div className="p-6 text-black">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-xl font-bold">SPK / Work Order</p>
          <p className="text-sm">WO: {props.woNumber}</p>
          <p className="text-sm">Tanggal: {props.dateTime.replace("T", " ")}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold">Plat</p>
          <p className="text-lg font-bold">{displayVehicle.plateNumber || "-"}</p>
        </div>
      </div>

      <div className="grid gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded border border-black/20 p-3">
            <p className="text-xs font-semibold">Customer</p>
            <p className="text-sm font-semibold">{displayCustomer.name || "-"}</p>
            <p className="text-xs">{displayCustomer.phone || "-"}</p>
            <p className="text-xs">{displayCustomer.address || "-"}</p>
          </div>
          <div className="rounded border border-black/20 p-3">
            <p className="text-xs font-semibold">Kendaraan</p>
            <p className="text-sm font-semibold">
              {displayVehicle.brand} {displayVehicle.model}
            </p>
            <p className="text-xs">KM: {displayVehicle.km || "-"}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded border border-black/20 p-3">
            <p className="text-xs font-semibold">Advisor</p>
            <p className="text-sm">{advisor?.name ?? advisor?.email ?? "-"}</p>
          </div>
          <div className="rounded border border-black/20 p-3">
            <p className="text-xs font-semibold">Mechanics</p>
            <p className="text-sm">{mechanicNames.length ? mechanicNames.join(", ") : "-"}</p>
          </div>
        </div>

        <div className="rounded border border-black/20">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="border-b border-black/20 p-2 text-left text-xs">Item</th>
                <th className="border-b border-black/20 p-2 text-right text-xs">Qty</th>
                <th className="border-b border-black/20 p-2 text-right text-xs">Price</th>
                <th className="border-b border-black/20 p-2 text-right text-xs">Total</th>
              </tr>
            </thead>
            <tbody>
              {props.items.map((it) => (
                <tr key={it.clientId}>
                  <td className="border-b border-black/10 p-2 text-xs">{it.name}</td>
                  <td className="border-b border-black/10 p-2 text-right text-xs">{it.qty}</td>
                  <td className="border-b border-black/10 p-2 text-right text-xs">{money(it.price)}</td>
                  <td className="border-b border-black/10 p-2 text-right text-xs">{money(it.qty * it.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="grid gap-1 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span>Subtotal</span>
              <span className="font-semibold">Rp {money(props.subtotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Discount (%)</span>
              <span className="font-semibold">{props.discountPercent}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Tax (%)</span>
              <span className="font-semibold">{props.taxPercent}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Grand Total</span>
              <span className="font-semibold">Rp {money(props.grandTotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Dibayar</span>
              <span className="font-semibold">Rp {money(props.paidAmount)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Kembalian</span>
              <span className="font-semibold">Rp {money(props.changeAmount)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

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
import { useDebouncedValue } from "~/hooks/use-debounced-value";
import { useToast } from "~/hooks/use-toast";
import { cn, formatRupiah } from "~/lib/utils";
import { api } from "~/trpc/react";

type WoStatus =
  | "DRAFT"
  | "ANTRIAN"
  | "PROSES"
  | "SELESAI"
  | "DIAMBIL"
  | "OPEN"
  | "DONE"
  | "CANCELLED";

function statusLabel(status: WoStatus) {
  switch (status) {
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

function statusBadgeClass(status: WoStatus) {
  switch (status) {
    case "DRAFT":
      return "border-slate-200 bg-slate-50 text-slate-700";
    case "ANTRIAN":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "PROSES":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "SELESAI":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "DIAMBIL":
      return "border-purple-200 bg-purple-50 text-purple-700";
    case "CANCELLED":
      return "border-red-200 bg-red-50 text-red-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function formatDateTime(d: Date) {
  const date = new Intl.DateTimeFormat("id-ID", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
  return date;
}

function normalizePhoneForWa(phone: string) {
  const trimmed = phone.trim();
  if (!trimmed) return "";
  const digits = trimmed.replace(/[^0-9+]/g, "");
  if (digits.startsWith("+")) return digits.slice(1);
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("62")) return digits;
  return digits;
}

function makeWaInvoiceText(params: {
  woNumber: string;
  customerName?: string | null;
  plateNumber?: string | null;
  grandTotal: number;
}) {
  const name = params.customerName?.trim() ? params.customerName.trim() : "Customer";
  const plate = params.plateNumber?.trim() ? params.plateNumber.trim() : "-";
  return [
    `Halo ${name},`,
    "",
    `Invoice WO: ${params.woNumber}`,
    `Kendaraan: ${plate}`,
    `Total: ${formatRupiah(params.grandTotal)}`,
    "",
    "Terima kasih.",
  ].join("\n");
}

export default function ServiceListPage() {
  const router = useRouter();
  const { toast } = useToast();
  const utils = api.useUtils();

  const [deleteConfirm, setDeleteConfirm] = React.useState<
    | { open: true; id: string; woNumber: string }
    | { open: false }
  >({ open: false });

  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebouncedValue(search, 350);

  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState<10 | 20 | 50>(10);

  const listQuery = api.service.searchWorkOrders.useQuery(
    {
      page,
      limit,
      query: debouncedSearch ? debouncedSearch : undefined,
    },
    { retry: false },
  );

  React.useEffect(() => {
    setPage(1);
  }, [debouncedSearch, limit]);

  const createDraft = api.service.createDraft.useMutation({
    onSuccess: async (wo) => {
      await Promise.all([
        utils.service.searchWorkOrders.invalidate(),
        utils.service.recent.invalidate(),
      ]);
      router.push(`/admin/service/${wo.id}`);
    },
    onError: (e) => toast({ variant: "destructive", title: "Gagal", description: e.message }),
  });

  const deleteMutation = api.service.deleteWorkOrder.useMutation({
    onSuccess: async () => {
      toast({ variant: "success", title: "WO dihapus" });
      setDeleteConfirm({ open: false });
      await Promise.all([
        utils.service.searchWorkOrders.invalidate(),
        utils.service.recent.invalidate(),
      ]);
    },
    onError: (e) => toast({ variant: "destructive", title: "Gagal", description: e.message }),
  });

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <Card className="border border-slate-200/70 bg-white/60 shadow-sm backdrop-blur-lg">
      <Dialog
        open={deleteConfirm.open}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirm({ open: false });
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus WO</DialogTitle>
            <DialogDescription>
              {deleteConfirm.open ? `Hapus WO ${deleteConfirm.woNumber}?` : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" type="button" onClick={() => setDeleteConfirm({ open: false })}>
              Batal
            </Button>
            <Button
              type="button"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (!deleteConfirm.open) return;
                deleteMutation.mutate({ id: deleteConfirm.id });
              }}
            >
              {deleteMutation.isPending ? "Menghapus..." : "Hapus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-slate-900">Work Orders</CardTitle>
          <p className="mt-1 text-sm text-slate-600">Buat WO cepat, simpan draft, lanjutkan kapan saja.</p>
        </div>

        <Button onClick={() => createDraft.mutate()} disabled={createDraft.isPending}>
          {createDraft.isPending ? "Membuat..." : "+ Tambah WO"}
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-full sm:max-w-md">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari WO / customer / plat"
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
                <TableHead>WO</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Kendaraan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead>Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <div className="py-10 text-center text-sm text-slate-600">Loading...</div>
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <div className="py-12 text-center">
                      <p className="text-sm font-semibold text-slate-900">Belum ada WO</p>
                      <p className="mt-1 text-sm text-slate-600">Klik &quot;+ Tambah WO&quot; untuk mulai.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                items.map((wo) => (
                  <TableRow
                    key={wo.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/admin/service/${wo.id}`)}
                  >
                    <TableCell className="font-semibold">{wo.woNumber}</TableCell>
                    <TableCell>{wo.customer?.name ?? "-"}</TableCell>
                    <TableCell>{wo.vehicle?.plateNumber ?? "-"}</TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold",
                          statusBadgeClass(wo.status as WoStatus),
                        )}
                      >
                        {statusLabel(wo.status as WoStatus)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{formatRupiah(wo.grandTotal ?? 0)}</TableCell>
                    <TableCell className="text-sm text-slate-700">{formatDateTime(new Date(wo.createdAt))}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/admin/service/${wo.id}?tab=customer`);
                          }}
                        >
                          Edit CS
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/admin/service/${wo.id}?tab=order`);
                          }}
                        >
                          Edit Order
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/admin/service/${wo.id}?tab=payment`);
                          }}
                        >
                          Edit Payment
                        </Button>

                        <Button
                          type="button"
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            const phone = normalizePhoneForWa(wo.customer?.phone ?? "");
                            if (!phone) {
                              toast({
                                variant: "destructive",
                                title: "No HP customer kosong",
                                description: "Isi nomor HP customer dulu agar bisa kirim invoice via WA.",
                              });
                              return;
                            }

                            const text = makeWaInvoiceText({
                              woNumber: wo.woNumber,
                              customerName: wo.customer?.name,
                              plateNumber: wo.vehicle?.plateNumber,
                              grandTotal: wo.grandTotal ?? 0,
                            });
                            const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
                            window.open(url, "_blank", "noopener,noreferrer");
                          }}
                        >
                          Kirim WA
                        </Button>

                        <Button
                          type="button"
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirm({ open: true, id: wo.id, woNumber: wo.woNumber });
                          }}
                        >
                          Delete
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
    </Card>
  );
}

"use client";

import * as React from "react";
import { useParams } from "next/navigation";

import { Button } from "~/components/ui/button";
import { cn, formatRupiah } from "~/lib/utils";
import { api } from "~/trpc/react";

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "-";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return "-";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

function fmtTime(d: Date | string | null | undefined) {
  if (!d) return "-";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return "-";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

export default function WorkOrderPrintPage() {
  const params = useParams<{ id: string }>();
  const woId = params?.id ? String(params.id) : "";

  const woQuery = api.service.getById.useQuery(
    { id: woId },
    {
      retry: false,
      enabled: Boolean(woId),
    },
  );

  React.useEffect(() => {
    if (!woQuery.data) return;
    const t = window.setTimeout(() => {
      window.print();
    }, 250);
    return () => window.clearTimeout(t);
  }, [woQuery.data]);

  if (woQuery.isLoading) {
    return <div className="p-6 text-sm text-slate-700">Loading...</div>;
  }

  if (!woQuery.data) {
    return <div className="p-6 text-sm text-slate-700">WO tidak ditemukan</div>;
  }

  const wo: any = woQuery.data;

  const mechanicNames = (wo.mechanics ?? [])
    .map((m: any) => m?.user?.name ?? "")
    .filter((v: string) => Boolean(v))
    .join(", ");

  const advisorName = wo.advisor?.name ?? wo.advisor?.email ?? "-";

  const items = (wo.items ?? []).map((it: any) => ({
    code: it.type,
    name: it.name,
    qty: it.qty,
    price: it.price,
  }));

  const subtotal = Number(wo.subtotal ?? 0);
  const dp = Number(wo.dp ?? 0);
  const grandTotal = Number(wo.grandTotal ?? 0);

  return (
    <div className="min-h-screen bg-slate-100 p-4 print:bg-white print:p-0">
      <div className="mx-auto w-full max-w-[900px]">
        <div className="mb-3 flex items-center justify-between gap-2 print:hidden">
          <div className="text-sm text-slate-600">Preview Print WO</div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => window.close()}>
              Close
            </Button>
            <Button onClick={() => window.print()}>Print</Button>
          </div>
        </div>

        <div className="bg-white p-6 text-[12px] text-black print:p-0">
          <div className="grid grid-cols-3 items-start gap-2">
            <div>
              <div className="text-sm font-bold">BengkelAsia</div>
              <div className="mt-1 leading-tight text-black/80">Jl. ________</div>
            </div>
            <div className="text-center font-semibold">Surat Perintah Kerja</div>
            <div className="text-right">
              <div>No. WO: {wo.woNumber}</div>
              <div>Tgl: {fmtDate(wo.createdAt)}</div>
              <div>Jam: {fmtTime(wo.createdAt)}</div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="border border-black p-3">
              <div className="font-semibold">Pemilik</div>
              <div className="mt-2 grid gap-1">
                <div>Nama: {wo.customer?.name ?? "-"}</div>
                <div>Telepon: {wo.customer?.phone ?? "-"}</div>
              </div>
            </div>

            <div className="border border-black p-3">
              <div className="font-semibold">Kendaraan</div>
              <div className="mt-2 grid gap-1">
                <div>Plat: {wo.vehicle?.plateNumber ?? "-"}</div>
                <div>
                  Merk/Model: {wo.vehicle?.brand ?? "-"} {wo.vehicle?.model ?? ""}
                </div>
                <div>KM/Odo: {wo.odo ?? wo.vehicle?.currentOdometer ?? "-"}</div>
              </div>
            </div>
          </div>

          <div className="mt-3 border border-black">
            <div className="border-b border-black p-2">
              <div className="font-semibold">Jenis Pekerjaan</div>
              <div className="mt-1">{wo.jobType ?? "-"}</div>
            </div>

            <div className="grid grid-cols-2">
              <div className="border-r border-black p-2">
                <div className="font-semibold">Pengecekan</div>
                <div className="mt-2 font-semibold">Sebelum</div>
                <div className="mt-1 min-h-[90px] whitespace-pre-wrap">{wo.preCheck ?? ""}</div>
              </div>
              <div className="p-2">
                <div className="font-semibold">&nbsp;</div>
                <div className="mt-2 font-semibold">Sesudah</div>
                <div className="mt-1 min-h-[90px] whitespace-pre-wrap">{wo.postCheck ?? ""}</div>
              </div>
            </div>

            <div className="border-t border-black p-2">
              <div className="font-semibold">Mekanik</div>
              <div className="mt-1">{mechanicNames || "-"}</div>
            </div>

            <div className="border-t border-black p-2">
              <div className="font-semibold">Service Advisor</div>
              <div className="mt-1">{advisorName}</div>
            </div>

            <div className="border-t border-black p-2">
              <div className="font-semibold">Perkiraan Biaya</div>

              <div className="mt-2">
                <div className="grid grid-cols-[50px_110px_1fr_70px_110px] border-b border-black px-1 py-1 font-semibold">
                  <div>No</div>
                  <div>Kode</div>
                  <div>Keterangan</div>
                  <div className="text-right">Qty</div>
                  <div className="text-right">Biaya</div>
                </div>

                {items.length === 0 ? (
                  <div className="px-1 py-2 text-black/70">Tidak ada item</div>
                ) : (
                  items.map((it: any, idx: number) => (
                    <div
                      key={`${it.code}-${idx}`}
                      className={cn(
                        "grid grid-cols-[50px_110px_1fr_70px_110px] px-1 py-1",
                        idx === items.length - 1 ? "" : "border-b border-black/30",
                      )}
                    >
                      <div>{idx + 1}</div>
                      <div>{it.code}</div>
                      <div>{it.name}</div>
                      <div className="text-right">{it.qty}</div>
                      <div className="text-right">{formatRupiah(Number(it.qty ?? 0) * Number(it.price ?? 0))}</div>
                    </div>
                  ))
                )}

                <div className="mt-2 grid justify-end">
                  <div className="grid w-[280px] grid-cols-2 gap-y-1">
                    <div className="text-right">Subtotal</div>
                    <div className="text-right">{formatRupiah(subtotal)}</div>
                    <div className="text-right">DP</div>
                    <div className="text-right">{formatRupiah(dp)}</div>
                    <div className="text-right font-semibold">Total</div>
                    <div className="text-right font-semibold">{formatRupiah(grandTotal)}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-black p-2">
              <div className="font-semibold">Keluhan</div>
              <div className="mt-2 min-h-[70px] whitespace-pre-wrap">{wo.complaint ?? ""}</div>
            </div>
          </div>

          <div className="mt-10 grid grid-cols-5 gap-6 text-center">
            <div>
              <div className="h-10" />
              <div className="border-t border-black pt-1">Mekanik</div>
            </div>
            <div>
              <div className="h-10" />
              <div className="border-t border-black pt-1">Service Advisor</div>
            </div>
            <div>
              <div className="h-10" />
              <div className="border-t border-black pt-1">Kasir</div>
            </div>
            <div>
              <div className="h-10" />
              <div className="border-t border-black pt-1">Service Manager</div>
            </div>
            <div>
              <div className="h-10" />
              <div className="border-t border-black pt-1">Pelanggan</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

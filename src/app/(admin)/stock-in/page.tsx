"use client";

import * as React from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Plus } from "lucide-react";

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
import { cn, formatRupiah, parseRupiah } from "~/lib/utils";
import { api } from "~/trpc/react";

const stockInSchema = z.object({
  productId: z.string().min(1, "Product wajib dipilih"),
  qty: z
    .string()
    .trim()
    .min(1, "Qty wajib diisi")
    .refine((v) => {
      const n = Number(v);
      return Number.isFinite(n) && n > 0;
    }, "Qty tidak valid"),
  buyPrice: z
    .string()
    .trim()
    .min(1, "Harga beli wajib diisi")
    .refine((v) => parseRupiah(v) >= 0, "Harga beli tidak valid"),
});

type StockInValues = z.infer<typeof stockInSchema>;

function safeInt(v: string) {
  const trimmed = v.trim();
  if (!trimmed) return 0;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return 0;
  const i = Math.floor(n);
  return i < 0 ? 0 : i;
}

function formatRupiahInput(value: string) {
  return formatRupiah(parseRupiah(value), { prefix: false });
}

export default function StockInPage() {
  const utils = api.useUtils();
  const { toast } = useToast();

  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebouncedValue(search, 300);

  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState<10 | 20 | 50>(20);

  const [modalOpen, setModalOpen] = React.useState(false);

  const productsQuery = api.inventory.listProducts.useQuery(
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

  const stockInMutation = api.inventory.stockIn.useMutation({
    onSuccess: async () => {
      await utils.inventory.listProducts.invalidate();
      toast({ variant: "success", title: "Stock berhasil ditambahkan" });
      setModalOpen(false);
      form.reset({ productId: "", qty: "", buyPrice: "" });
    },
    onError: (e) => toast({ variant: "destructive", title: "Gagal", description: e.message }),
  });

  const form = useForm<StockInValues>({
    resolver: zodResolver(stockInSchema),
    defaultValues: {
      productId: "",
      qty: "",
      buyPrice: "",
    },
  });

  const selectedProductId = form.watch("productId");

  React.useEffect(() => {
    if (!modalOpen) return;
    if (!selectedProductId) return;
    const currentBuyPrice = form.getValues("buyPrice");
    if (currentBuyPrice?.trim()) return;

    const selected = (productsQuery.data?.items ?? []).find((p) => p.id === selectedProductId) as any;
    const next = selected?.buyPriceDefault;
    if (typeof next === "number") {
      form.setValue("buyPrice", formatRupiah(next, { prefix: false }), { shouldDirty: true });
    }
  }, [form, modalOpen, productsQuery.data?.items, selectedProductId]);

  const onSubmit = form.handleSubmit(async (values) => {
    await stockInMutation.mutateAsync({
      productId: values.productId,
      qty: safeInt(values.qty),
      buyPrice: parseRupiah(values.buyPrice),
    });
  });

  const items = productsQuery.data?.items ?? [];
  const total = productsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <Card className="border border-slate-200/70 bg-white/60 shadow-sm backdrop-blur-lg">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-slate-900">Stock In</CardTitle>
          <p className="mt-1 text-sm text-slate-600">Tambah stok (batch FIFO) + simpan HPP.</p>
        </div>

        <Button onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" />
          Stock In
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-full sm:max-w-md">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari product (nama/brand/unit)"
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
                <TableHead>Tipe</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Harga Beli</TableHead>
                <TableHead className="text-right">HPP Terakhir</TableHead>
                <TableHead className="text-right">Harga Jual</TableHead>
                <TableHead className="text-right">Stok</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productsQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={8}>
                    <div className="py-8 text-center text-sm text-slate-600">Loading...</div>
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8}>
                    <div className="py-10 text-center">
                      <p className="text-sm font-semibold text-slate-900">Product belum ada</p>
                      <p className="mt-1 text-sm text-slate-600">
                        Tambahkan product dulu di halaman Product.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                items.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-semibold">{p.name}</TableCell>
                    <TableCell>{p.type === "SPAREPART" ? "Sparepart" : "Oli"}</TableCell>
                    <TableCell>{p.brand ?? "-"}</TableCell>
                    <TableCell>{p.unit.name}</TableCell>
                    <TableCell className="text-right">{formatRupiah((p as any).buyPriceDefault ?? 0)}</TableCell>
                    <TableCell className="text-right">
                      {(p as any).lastBuyPrice != null
                        ? formatRupiah((p as any).lastBuyPrice as number)
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right">{formatRupiah(p.sellPrice)}</TableCell>
                    <TableCell className="text-right">{p.stockAvailable}</TableCell>
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
              disabled={page <= 1 || productsQuery.isFetching}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </Button>
            <Button
              variant="secondary"
              disabled={page >= totalPages || productsQuery.isFetching}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      </CardContent>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Stock In</DialogTitle>
            <DialogDescription>
              Input barang masuk. Sistem akan membuat batch FIFO dan menyimpan HPP.
            </DialogDescription>
          </DialogHeader>

          <form className="px-6 pb-2 pt-4" onSubmit={onSubmit}>
            <div className="grid gap-3">
              <div className="grid gap-2">
                <label className="text-sm font-semibold text-slate-700" htmlFor="product">
                  Product
                </label>
                <select
                  id="product"
                  className={cn(
                    "h-11 rounded-xl border border-white/20 bg-white/40 px-3 text-sm text-slate-900 shadow-sm backdrop-blur-md",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200",
                  )}
                  value={form.watch("productId")}
                  onChange={(e) => form.setValue("productId", e.target.value)}
                >
                  <option value="">Pilih product</option>
                  {(productsQuery.data?.items ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.type === "SPAREPART" ? "Sparepart" : "Oli"}) - stok {p.stockAvailable}
                    </option>
                  ))}
                </select>
                {form.formState.errors.productId ? (
                  <p className="text-sm text-red-600">{form.formState.errors.productId.message}</p>
                ) : null}
              </div>

              <div className="grid gap-1">
                <label className="text-sm font-semibold text-slate-700" htmlFor="qty">
                  Qty
                </label>
                <Input id="qty" inputMode="numeric" {...form.register("qty")} />
                {form.formState.errors.qty ? (
                  <p className="text-sm text-red-600">{form.formState.errors.qty.message}</p>
                ) : null}
              </div>

              <div className="grid gap-1">
                <label className="text-sm font-semibold text-slate-700" htmlFor="buyPrice">
                  Harga Beli (HPP)
                </label>
                <Input id="buyPrice" inputMode="numeric" {...form.register("buyPrice")} />
                {form.formState.errors.buyPrice ? (
                  <p className="text-sm text-red-600">{form.formState.errors.buyPrice.message}</p>
                ) : null}
              </div>
            </div>

            <div className="px-6 pb-2">
              <Button
                variant="secondary"
                type="button"
                onClick={() => {
                  const next = formatRupiahInput(form.getValues("buyPrice"));
                  form.setValue("buyPrice", next, { shouldDirty: true });
                }}
              >
                Format Rupiah
              </Button>
            </div>

            <DialogFooter className="px-0 pb-2 pt-6">
              <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={stockInMutation.isPending}>
                {stockInMutation.isPending ? "Menyimpan..." : "Simpan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

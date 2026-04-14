"use client";

import * as React from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Pencil, Plus, Trash2 } from "lucide-react";

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
import { type RouterInputs, type RouterOutputs } from "~/trpc/react";

const rupiahInputSchema = z
  .string()
  .trim()
  .min(1, "Wajib diisi")
  .refine((v) => parseRupiah(v) >= 0, "Nilai tidak valid");

const productFormSchema = z
  .object({
    name: z.string().trim().min(2, "Nama minimal 2 karakter").max(120),
    type: z.enum(["SPAREPART", "OIL"]),
    brandId: z.string().optional(),
    unitId: z.string().min(1, "Unit wajib dipilih"),
    buyPriceDefault: rupiahInputSchema,
    marginMode: z.enum(["PERCENT", "NOMINAL"]),
    marginValue: z.string().trim(),
    sellPrice: rupiahInputSchema,
  })
  .superRefine((val, ctx) => {
    if (val.type === "OIL" && !val.brandId?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Brand wajib dipilih untuk oli",
        path: ["brandId"],
      });
    }
  });

type ProductFormValues = z.infer<typeof productFormSchema>;

const unitFormSchema = z.object({
  name: z.string().trim().min(1, "Nama unit wajib diisi").max(30),
});

type UnitFormValues = z.infer<typeof unitFormSchema>;

const brandFormSchema = z.object({
  name: z.string().trim().min(2, "Nama brand minimal 2 karakter").max(60),
});

type BrandFormValues = z.infer<typeof brandFormSchema>;

type ProductListItem = RouterOutputs["inventory"]["listProducts"]["items"][number];
type CreateProductInput = RouterInputs["inventory"]["createProduct"];
type UpdateProductInput = RouterInputs["inventory"]["updateProduct"];

function formatRupiahInput(value: string) {
  return formatRupiah(parseRupiah(value), { prefix: false });
}

export default function ProductPage() {
  const utils = api.useUtils();
  const { toast } = useToast();

  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebouncedValue(search, 400);

  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState<10 | 20 | 50>(10);

  const [productModalOpen, setProductModalOpen] = React.useState(false);
  const [unitModalOpen, setUnitModalOpen] = React.useState(false);
  const [brandModalOpen, setBrandModalOpen] = React.useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = React.useState(false);

  const [mode, setMode] = React.useState<"create" | "edit">("create");
  const [editProductId, setEditProductId] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<{ id: string; name: string } | null>(null);

  const listQuery = api.inventory.listProducts.useQuery(
    {
      page,
      limit,
      query: debouncedSearch ? debouncedSearch : undefined,
    },
    { retry: false },
  );

  const unitsQuery = api.inventory.listUnits.useQuery(undefined, {
    retry: false,
    staleTime: 60_000,
  });

  const brandsQuery = api.inventory.listBrands.useQuery(undefined, {
    retry: false,
    staleTime: 60_000,
  });

  const editQuery = api.inventory.getProductById.useQuery(
    { id: editProductId ?? "" },
    {
      enabled: productModalOpen && mode === "edit" && !!editProductId,
      retry: false,
    },
  );

  React.useEffect(() => {
    setPage(1);
  }, [debouncedSearch, limit]);

  const createProduct = api.inventory.createProduct.useMutation({
    onSuccess: async () => {
      await utils.inventory.listProducts.invalidate();
      toast({ variant: "success", title: "Product berhasil dibuat" });
      setProductModalOpen(false);
    },
    onError: (e) => toast({ variant: "destructive", title: "Gagal", description: e.message }),
  });

  const updateProduct = api.inventory.updateProduct.useMutation({
    onSuccess: async () => {
      await utils.inventory.listProducts.invalidate();
      toast({ variant: "success", title: "Product berhasil diupdate" });
      setProductModalOpen(false);
      setEditProductId(null);
    },
    onError: (e) => toast({ variant: "destructive", title: "Gagal", description: e.message }),
  });

  const deleteProduct = api.inventory.deleteProduct.useMutation({
    onSuccess: async () => {
      await utils.inventory.listProducts.invalidate();
      toast({ variant: "success", title: "Product berhasil dihapus" });
      setDeleteModalOpen(false);
      setDeleteTarget(null);
    },
    onError: (e) => toast({ variant: "destructive", title: "Gagal", description: e.message }),
  });

  const createUnit = api.inventory.createUnit.useMutation({
    onSuccess: async () => {
      await utils.inventory.listUnits.invalidate();
      toast({ variant: "success", title: "Unit berhasil dibuat" });
      setUnitModalOpen(false);
      unitForm.reset({ name: "" });
    },
    onError: (e) => toast({ variant: "destructive", title: "Gagal", description: e.message }),
  });

  const createBrand = api.inventory.createBrand.useMutation({
    onSuccess: async () => {
      await utils.inventory.listBrands.invalidate();
      toast({ variant: "success", title: "Brand berhasil dibuat" });
      setBrandModalOpen(false);
      brandForm.reset({ name: "" });
    },
    onError: (e) => toast({ variant: "destructive", title: "Gagal", description: e.message }),
  });

  const productForm = useForm<ProductFormValues>({
    defaultValues: {
      name: "",
      type: "SPAREPART",
      brandId: "",
      unitId: "",
      buyPriceDefault: "0",
      marginMode: "PERCENT",
      marginValue: "0",
      sellPrice: "0",
    },
  });

  const [autoSellPrice, setAutoSellPrice] = React.useState(true);

  const unitForm = useForm<UnitFormValues>({
    resolver: zodResolver(unitFormSchema),
    defaultValues: { name: "" },
  });

  const brandForm = useForm<BrandFormValues>({
    resolver: zodResolver(brandFormSchema),
    defaultValues: { name: "" },
  });

  React.useEffect(() => {
    if (!productModalOpen) return;

    if (mode === "create") {
      setEditProductId(null);
      setAutoSellPrice(true);
      productForm.reset({
        name: "",
        type: "SPAREPART",
        brandId: "",
        unitId: unitsQuery.data?.[0]?.id ?? "",
        buyPriceDefault: "0",
        marginMode: "PERCENT",
        marginValue: "0",
        sellPrice: "0",
      });
      return;
    }

    const p = editQuery.data;
    if (!p) return;

    productForm.reset({
      name: p.name,
      type: p.type,
      brandId: p.brandId ?? "",
      unitId: p.unitId,
      buyPriceDefault: String(p.buyPriceDefault),
      marginMode: "PERCENT",
      marginValue: "0",
      sellPrice: String(p.sellPrice),
    });
    setAutoSellPrice(false);
  }, [editQuery.data, mode, productForm, productModalOpen, unitsQuery.data]);

  const buyPriceDefaultWatch = productForm.watch("buyPriceDefault");
  const marginModeWatch = productForm.watch("marginMode");
  const marginValueWatch = productForm.watch("marginValue");

  React.useEffect(() => {
    if (!productModalOpen) return;
    if (!autoSellPrice) return;

    const buy = parseRupiah(buyPriceDefaultWatch);
    const marginRaw = marginValueWatch?.trim() ?? "0";

    let computed = buy;
    if (marginModeWatch === "PERCENT") {
      const pct = Math.max(0, Math.min(1000, Number(marginRaw.replace(/[^0-9.]/g, "")) || 0));
      computed = Math.floor(buy + (buy * pct) / 100);
    } else {
      computed = buy + parseRupiah(marginRaw);
    }

    productForm.setValue("sellPrice", formatRupiah(computed, { prefix: false }), {
      shouldDirty: true,
    });
  }, [
    autoSellPrice,
    buyPriceDefaultWatch,
    marginModeWatch,
    marginValueWatch,
    productForm,
    productModalOpen,
  ]);

  const onSubmitProduct = productForm.handleSubmit(async (values) => {
    const parsed = productFormSchema.safeParse(values);
    if (!parsed.success) {
      const keys: ReadonlyArray<keyof ProductFormValues> = [
        "name",
        "type",
        "brandId",
        "unitId",
        "buyPriceDefault",
        "marginMode",
        "marginValue",
        "sellPrice",
      ];

      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field !== "string") continue;
        if (!keys.includes(field as keyof ProductFormValues)) continue;

        productForm.setError(field as keyof ProductFormValues, {
          type: "manual",
          message: issue.message,
        });
      }
      return;
    }

    const data = parsed.data;
    const payload: CreateProductInput = {
      name: data.name,
      type: data.type,
      brandId: data.brandId?.trim() ? data.brandId.trim() : undefined,
      unitId: data.unitId,
      buyPriceDefault: parseRupiah(data.buyPriceDefault),
      sellPrice: parseRupiah(data.sellPrice),
    };

    if (mode === "create") {
      await createProduct.mutateAsync(payload);
      return;
    }

    if (!editProductId) return;

    const updatePayload: UpdateProductInput = { id: editProductId, ...payload };
    await updateProduct.mutateAsync(updatePayload);
  });

  const onSubmitUnit = unitForm.handleSubmit(async (values) => {
    await createUnit.mutateAsync({ name: values.name });
  });

  const onSubmitBrand = brandForm.handleSubmit(async (values) => {
    await createBrand.mutateAsync({ name: values.name });
  });

  const items: ProductListItem[] = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <Card className="border border-slate-200/70 bg-white/60 shadow-sm backdrop-blur-lg">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-slate-900">Product</CardTitle>
          <p className="mt-1 text-sm text-slate-600">
            Kelola product sparepart/oli dan lihat stok.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setUnitModalOpen(true)}>
            Unit
          </Button>
          <Button variant="secondary" onClick={() => setBrandModalOpen(true)}>
            Brand
          </Button>
          <Button
            onClick={() => {
              setMode("create");
              setProductModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Tambah Product
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-full sm:max-w-md">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama / brand / unit"
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
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={9}>
                    <div className="py-8 text-center text-sm text-slate-600">Loading...</div>
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9}>
                    <div className="py-10 text-center">
                      <p className="text-sm font-semibold text-slate-900">Product belum ada</p>
                      <p className="mt-1 text-sm text-slate-600">
                        Klik tombol Tambah Product untuk membuat data baru.
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
                    <TableCell className="text-right">{formatRupiah(p.buyPriceDefault)}</TableCell>
                    <TableCell className="text-right">
                      {p.lastBuyPrice != null
                        ? formatRupiah(p.lastBuyPrice)
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right">{formatRupiah(p.sellPrice)}</TableCell>
                    <TableCell className="text-right">{p.stockAvailable}</TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Edit"
                          onClick={() => {
                            setMode("edit");
                            setEditProductId(p.id);
                            setProductModalOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Delete"
                          onClick={() => {
                            setDeleteTarget({ id: p.id, name: p.name });
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

      <Dialog open={productModalOpen} onOpenChange={setProductModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "Tambah Product" : "Edit Product"}</DialogTitle>
            <DialogDescription>Isi data produk untuk kebutuhan service & inventory.</DialogDescription>
          </DialogHeader>

          {mode === "edit" && editQuery.isLoading ? (
            <div className="px-6 pb-6 pt-4 text-sm text-slate-600">Loading...</div>
          ) : (
            <form className="px-6 pb-2 pt-4" onSubmit={onSubmitProduct}>
              <div className="grid gap-3">
                <div className="grid gap-1">
                  <label className="text-sm font-semibold text-slate-700" htmlFor="name">
                    Nama
                  </label>
                  <Input id="name" {...productForm.register("name")} />
                  {productForm.formState.errors.name ? (
                    <p className="text-sm text-red-600">{productForm.formState.errors.name.message}</p>
                  ) : null}
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-semibold text-slate-700" htmlFor="type">
                    Type
                  </label>
                  <select
                    id="type"
                    className={cn(
                      "h-11 rounded-xl border border-white/20 bg-white/40 px-3 text-sm text-slate-900 shadow-sm backdrop-blur-md",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200",
                    )}
                    value={productForm.watch("type")}
                    onChange={(e) => productForm.setValue("type", e.target.value as "SPAREPART" | "OIL")}
                  >
                    <option value="SPAREPART">Sparepart</option>
                    <option value="OIL">Oli</option>
                  </select>
                </div>

                {productForm.watch("type") === "OIL" ? (
                  <div className="grid gap-2">
                    <label className="text-sm font-semibold text-slate-700" htmlFor="brandId">
                      Brand
                    </label>
                    <select
                      id="brandId"
                      className={cn(
                        "h-11 rounded-xl border border-white/20 bg-white/40 px-3 text-sm text-slate-900 shadow-sm backdrop-blur-md",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200",
                      )}
                      value={productForm.watch("brandId") ?? ""}
                      onChange={(e) => productForm.setValue("brandId", e.target.value)}
                    >
                      <option value="">Pilih Brand</option>
                      {(brandsQuery.data ?? []).map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                    {productForm.formState.errors.brandId ? (
                      <p className="text-sm text-red-600">{productForm.formState.errors.brandId.message}</p>
                    ) : null}
                  </div>
                ) : null}

                <div className="grid gap-2">
                  <label className="text-sm font-semibold text-slate-700" htmlFor="unit">
                    Unit
                  </label>
                  <select
                    id="unit"
                    className={cn(
                      "h-11 rounded-xl border border-white/20 bg-white/40 px-3 text-sm text-slate-900 shadow-sm backdrop-blur-md",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200",
                    )}
                    value={productForm.watch("unitId")}
                    onChange={(e) => productForm.setValue("unitId", e.target.value)}
                  >
                    <option value="">Pilih Unit</option>
                    {(unitsQuery.data ?? []).map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                  {productForm.formState.errors.unitId ? (
                    <p className="text-sm text-red-600">{productForm.formState.errors.unitId.message}</p>
                  ) : null}
                </div>

                <div className="grid gap-1">
                  <label className="text-sm font-semibold text-slate-700" htmlFor="buyPriceDefault">
                    Harga Beli (Default)
                  </label>
                  <Input
                    id="buyPriceDefault"
                    inputMode="numeric"
                    {...productForm.register("buyPriceDefault")}
                    onBlur={(e) => {
                      const next = formatRupiahInput(e.target.value);
                      productForm.setValue("buyPriceDefault", next, { shouldDirty: true });
                    }}
                  />
                  {productForm.formState.errors.buyPriceDefault ? (
                    <p className="text-sm text-red-600">
                      {productForm.formState.errors.buyPriceDefault.message}
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-semibold text-slate-700" htmlFor="marginMode">
                    Margin
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      id="marginMode"
                      className={cn(
                        "h-11 rounded-xl border border-white/20 bg-white/40 px-3 text-sm text-slate-900 shadow-sm backdrop-blur-md",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200",
                      )}
                      value={productForm.watch("marginMode")}
                      onChange={(e) => {
                        setAutoSellPrice(true);
                        productForm.setValue(
                          "marginMode",
                          e.target.value === "NOMINAL" ? "NOMINAL" : "PERCENT",
                          { shouldDirty: true },
                        );
                      }}
                    >
                      <option value="PERCENT">Persen (%)</option>
                      <option value="NOMINAL">Nominal (Rp)</option>
                    </select>

                    <Input
                      inputMode="numeric"
                      value={productForm.watch("marginValue")}
                      onChange={(e) => {
                        setAutoSellPrice(true);
                        productForm.setValue("marginValue", e.target.value, { shouldDirty: true });
                      }}
                      onBlur={(e) => {
                        if (productForm.watch("marginMode") === "NOMINAL") {
                          const next = formatRupiahInput(e.target.value);
                          productForm.setValue("marginValue", next, { shouldDirty: true });
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="grid gap-1">
                  <label className="text-sm font-semibold text-slate-700" htmlFor="sellPrice">
                    Harga Jual
                  </label>
                  <Input
                    id="sellPrice"
                    inputMode="numeric"
                    {...productForm.register("sellPrice")}
                    onChange={(e) => {
                      setAutoSellPrice(false);
                      productForm.setValue("sellPrice", e.target.value, { shouldDirty: true });
                    }}
                    onBlur={(e) => {
                      const next = formatRupiahInput(e.target.value);
                      productForm.setValue("sellPrice", next, { shouldDirty: true });
                    }}
                  />
                  {productForm.formState.errors.sellPrice ? (
                    <p className="text-sm text-red-600">{productForm.formState.errors.sellPrice.message}</p>
                  ) : null}
                </div>
              </div>

              <DialogFooter className="px-0 pb-2 pt-6">
                <Button variant="secondary" type="button" onClick={() => setProductModalOpen(false)}>
                  Batal
                </Button>
                <Button type="submit" disabled={createProduct.isPending || updateProduct.isPending}>
                  {createProduct.isPending || updateProduct.isPending ? "Menyimpan..." : "Simpan"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={unitModalOpen} onOpenChange={setUnitModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Unit</DialogTitle>
            <DialogDescription>Contoh: pcs, botol, liter</DialogDescription>
          </DialogHeader>

          <form className="px-6 pb-2 pt-4" onSubmit={onSubmitUnit}>
            <div className="grid gap-2">
              <div className="grid gap-1">
                <label className="text-sm font-semibold text-slate-700" htmlFor="unitName">
                  Nama Unit
                </label>
                <Input id="unitName" {...unitForm.register("name")} />
                {unitForm.formState.errors.name ? (
                  <p className="text-sm text-red-600">{unitForm.formState.errors.name.message}</p>
                ) : null}
              </div>
            </div>

            <DialogFooter className="px-0 pb-2 pt-6">
              <Button variant="secondary" type="button" onClick={() => setUnitModalOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={createUnit.isPending}>
                {createUnit.isPending ? "Menyimpan..." : "Simpan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={brandModalOpen} onOpenChange={setBrandModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Brand</DialogTitle>
            <DialogDescription>Contoh: Shell, Yamalube</DialogDescription>
          </DialogHeader>

          <form className="px-6 pb-2 pt-4" onSubmit={onSubmitBrand}>
            <div className="grid gap-2">
              <div className="grid gap-1">
                <label className="text-sm font-semibold text-slate-700" htmlFor="brandName">
                  Nama Brand
                </label>
                <Input id="brandName" {...brandForm.register("name")} />
                {brandForm.formState.errors.name ? (
                  <p className="text-sm text-red-600">{brandForm.formState.errors.name.message}</p>
                ) : null}
              </div>
            </div>

            <DialogFooter className="px-0 pb-2 pt-6">
              <Button variant="secondary" type="button" onClick={() => setBrandModalOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={createBrand.isPending}>
                {createBrand.isPending ? "Menyimpan..." : "Simpan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Hapus Product</DialogTitle>
            <DialogDescription>Product yang sudah dipakai tidak bisa dihapus.</DialogDescription>
          </DialogHeader>

          <div className="px-6 pb-2 pt-4">
            <p className="text-sm text-slate-700">Yakin ingin menghapus product:</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{deleteTarget?.name ?? "-"}</p>
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleteModalOpen(false)}>
              Batal
            </Button>
            <Button
              variant="default"
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={!deleteTarget || deleteProduct.isPending}
              onClick={async () => {
                if (!deleteTarget) return;
                await deleteProduct.mutateAsync({ id: deleteTarget.id });
              }}
            >
              {deleteProduct.isPending ? "Menghapus..." : "Hapus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

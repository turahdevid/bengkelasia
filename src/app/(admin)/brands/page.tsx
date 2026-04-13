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
import { useToast } from "~/hooks/use-toast";
import { api } from "~/trpc/react";

const brandSchema = z.object({
  name: z.string().trim().min(2, "Nama brand minimal 2 karakter").max(60),
});

type BrandValues = z.infer<typeof brandSchema>;

export default function BrandsPage() {
  const utils = api.useUtils();
  const { toast } = useToast();

  const [modalOpen, setModalOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [mode, setMode] = React.useState<"create" | "edit">("create");
  const [edit, setEdit] = React.useState<{ id: string; name: string } | null>(null);
  const [del, setDel] = React.useState<{ id: string; name: string } | null>(null);

  const listQuery = api.inventory.listBrands.useQuery(undefined, { retry: false });

  const createMutation = api.inventory.createBrand.useMutation({
    onSuccess: async () => {
      await utils.inventory.listBrands.invalidate();
      toast({ variant: "success", title: "Brand berhasil dibuat" });
      setModalOpen(false);
      form.reset({ name: "" });
    },
    onError: (e) => toast({ variant: "destructive", title: "Gagal", description: e.message }),
  });

  const updateMutation = api.inventory.updateBrand.useMutation({
    onSuccess: async () => {
      await utils.inventory.listBrands.invalidate();
      toast({ variant: "success", title: "Brand berhasil diupdate" });
      setModalOpen(false);
      setEdit(null);
      form.reset({ name: "" });
    },
    onError: (e) => toast({ variant: "destructive", title: "Gagal", description: e.message }),
  });

  const deleteMutation = api.inventory.deleteBrand.useMutation({
    onSuccess: async () => {
      await utils.inventory.listBrands.invalidate();
      toast({ variant: "success", title: "Brand berhasil dihapus" });
      setDeleteOpen(false);
      setDel(null);
    },
    onError: (e) => toast({ variant: "destructive", title: "Gagal", description: e.message }),
  });

  const form = useForm<BrandValues>({
    resolver: zodResolver(brandSchema),
    defaultValues: { name: "" },
  });

  React.useEffect(() => {
    if (!modalOpen) return;
    if (mode === "create") {
      form.reset({ name: "" });
      return;
    }
    if (edit) form.reset({ name: edit.name });
  }, [edit, form, modalOpen, mode]);

  const onSubmit = form.handleSubmit(async (values) => {
    if (mode === "create") {
      await createMutation.mutateAsync({ name: values.name });
      return;
    }
    if (!edit) return;
    await updateMutation.mutateAsync({ id: edit.id, name: values.name });
  });

  const items = listQuery.data ?? [];

  return (
    <Card className="border border-slate-200/70 bg-white/60 shadow-sm backdrop-blur-lg">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-slate-900">Brand</CardTitle>
          <p className="mt-1 text-sm text-slate-600">Master data brand untuk oli.</p>
        </div>

        <Button
          onClick={() => {
            setMode("create");
            setModalOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Tambah Brand
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-2xl border border-slate-200/70 bg-white/40 shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={2}>
                    <div className="py-8 text-center text-sm text-slate-600">Loading...</div>
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2}>
                    <div className="py-10 text-center">
                      <p className="text-sm font-semibold text-slate-900">Brand belum ada</p>
                      <p className="mt-1 text-sm text-slate-600">Tambahkan brand untuk mulai input oli.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                items.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-semibold">{b.name}</TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Edit"
                          onClick={() => {
                            setEdit({ id: b.id, name: b.name });
                            setMode("edit");
                            setModalOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Delete"
                          onClick={() => {
                            setDel({ id: b.id, name: b.name });
                            setDeleteOpen(true);
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

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "Tambah Brand" : "Edit Brand"}</DialogTitle>
            <DialogDescription>Gunakan nama brand yang konsisten.</DialogDescription>
          </DialogHeader>

          <form className="px-6 pb-2 pt-4" onSubmit={onSubmit}>
            <div className="grid gap-1">
              <label className="text-sm font-semibold text-slate-700" htmlFor="brandName">
                Nama
              </label>
              <Input id="brandName" {...form.register("name")} />
              {form.formState.errors.name ? (
                <p className="text-sm text-red-600">{form.formState.errors.name.message}</p>
              ) : null}
            </div>

            <DialogFooter className="px-0 pb-2 pt-6">
              <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending ? "Menyimpan..." : "Simpan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Hapus Brand</DialogTitle>
            <DialogDescription>Brand yang dipakai product tidak bisa dihapus.</DialogDescription>
          </DialogHeader>

          <div className="px-6 pb-2 pt-4">
            <p className="text-sm text-slate-700">Yakin ingin menghapus brand:</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{del?.name ?? "-"}</p>
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>
              Batal
            </Button>
            <Button
              variant="default"
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={!del || deleteMutation.isPending}
              onClick={async () => {
                if (!del) return;
                await deleteMutation.mutateAsync({ id: del.id });
              }}
            >
              {deleteMutation.isPending ? "Menghapus..." : "Hapus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

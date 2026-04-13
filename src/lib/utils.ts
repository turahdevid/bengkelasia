import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRupiah(value: number, opts?: { prefix?: boolean }) {
  const n = Number.isFinite(value) ? Math.floor(value) : 0;
  const formatted = new Intl.NumberFormat("id-ID").format(n);
  return opts?.prefix === false ? formatted : `Rp ${formatted}`;
}

export function parseRupiah(input: string) {
  const digitsOnly = (input ?? "").replace(/[^0-9]/g, "");
  if (!digitsOnly) return 0;
  const n = Number(digitsOnly);
  if (!Number.isFinite(n)) return 0;
  const i = Math.floor(n);
  return i < 0 ? 0 : i;
}

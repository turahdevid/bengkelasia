"use client";

import * as React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

function statusPillClass(status: string) {
  if (status === "SNOOZED") return "bg-red-100 text-red-700 border-red-200";
  if (status === "FOLLOWED_UP") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function formatDateTime(d: Date | string | null | undefined) {
  if (!d) return "-";
  const x = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("id-ID", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(x);
}

export default function CustomerBirthdayReminderPage() {
  const query = api.admin.listBirthdayReminders.useQuery({ take: 100 }, { retry: false });

  return (
    <Card className="border border-slate-200/70 bg-white/60 shadow-sm backdrop-blur-lg">
      <CardHeader>
        <CardTitle className="text-slate-900">Birthday Reminder</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tanggal</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Telepon</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Follow Up</TableHead>
              <TableHead>Snooze</TableHead>
              <TableHead>Handled By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(query.data?.items ?? []).map((r) => (
              <TableRow key={r.id}>
                <TableCell>{formatDateTime(r.reminderDate)}</TableCell>
                <TableCell className="font-semibold">{r.customer.name}</TableCell>
                <TableCell>{r.customer.phone}</TableCell>
                <TableCell>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold",
                      statusPillClass(r.status),
                    )}
                  >
                    {r.status}
                  </span>
                </TableCell>
                <TableCell>{formatDateTime(r.followedUpAt)}</TableCell>
                <TableCell>{formatDateTime(r.snoozedAt)}</TableCell>
                <TableCell>{r.handledByUser?.name ?? r.handledByUser?.email ?? "-"}</TableCell>
              </TableRow>
            ))}

            {(query.data?.items ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-slate-600">
                  {query.isLoading ? "Loading..." : "Belum ada data."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

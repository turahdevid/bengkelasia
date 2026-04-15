"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  CalendarDays,
  Banknote,
  Car,
  Gauge,
  TrendingUp,
  Users,
  Wrench,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { cn, formatRupiah } from "~/lib/utils";
import { api } from "~/trpc/react";

type ServiceDatum = {
  name: string;
  services: number;
  revenue: number;
};

function SummaryCard({
  title,
  value,
  delta,
  icon: Icon,
}: {
  title: string;
  value: string;
  delta: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="rounded-3xl border border-slate-200/70 bg-white/70 shadow-sm backdrop-blur-lg transition-all duration-200 hover:shadow-md">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">{title}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
              {value}
            </p>
          </div>
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-200/60 text-slate-900">
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 text-xs text-slate-600">
          <TrendingUp className="h-4 w-4 text-orange-500" />
          <span className="font-semibold text-slate-900">{delta}</span>
          <span>this week</span>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles =
    status === "DIAMBIL" || status === "SELESAI"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : status === "PROSES"
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : status === "ANTRIAN"
          ? "bg-blue-50 text-blue-700 border-blue-200"
          : "bg-slate-50 text-slate-700 border-slate-200";

  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium", styles)}>
      {status}
    </span>
  );
}

export default function AdminDashboardPage() {
  const [chartMode, setChartMode] = React.useState<"services" | "revenue">(
    "services",
  );

  const dashboardQuery = api.admin.getDashboardData.useQuery(
    { days: 7 },
    {
      retry: false,
    },
  );

  const data = dashboardQuery.data;
  const chartData: ServiceDatum[] = (data?.chart ?? []).map((c) => ({
    name: c.name,
    services: c.services,
    revenue: c.revenue,
  }));

  const completedCount = (data?.status.selesai ?? 0) + (data?.status.diambil ?? 0);

  return (
    <div className="space-y-6">
      <section className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-5 rounded-3xl border border-slate-200/70 bg-white/70 shadow-sm backdrop-blur-lg transition-all duration-200 hover:shadow-md">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-slate-500">Welcome in</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                  BengkelAsia
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Monitor services, customers, and workshop performance.
                </p>
              </div>
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-200/60 text-slate-900">
                <Gauge className="h-6 w-6" />
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl border border-slate-200/70 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium text-slate-500">Active bays</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {dashboardQuery.isLoading ? "-" : String(data?.status.proses ?? 0)}
                </p>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full w-[66%] rounded-full bg-amber-300" />
                </div>
              </div>
              <div className="rounded-3xl border border-slate-200/70 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium text-slate-500">Queue</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {dashboardQuery.isLoading ? "-" : String(data?.status.antrian ?? 0)}
                </p>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full w-[42%] rounded-full bg-slate-900" />
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-3xl border border-slate-200/70 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-700">
                  <CalendarDays className="h-4 w-4" />
                  <p className="text-sm font-medium">Today</p>
                </div>
                <p className="text-sm font-semibold text-slate-900">09:00</p>
              </div>
              <p className="mt-1 text-xs text-slate-500">Jakarta • Status: Open</p>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:col-span-7">
          <div className="grid gap-6 sm:grid-cols-2">
            <SummaryCard
              title="Total Customers"
              value={dashboardQuery.isLoading ? "-" : String(data?.counts.customers ?? 0)}
              delta="-"
              icon={Users}
            />
            <SummaryCard
              title="Total Vehicles"
              value={dashboardQuery.isLoading ? "-" : String(data?.counts.vehicles ?? 0)}
              delta="-"
              icon={Car}
            />
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <SummaryCard
              title="WO Hari Ini"
              value={dashboardQuery.isLoading ? "-" : String(data?.today.workOrders ?? 0)}
              delta="-"
              icon={Wrench}
            />
            <SummaryCard
              title="Omzet Hari Ini"
              value={dashboardQuery.isLoading ? "-" : formatRupiah(data?.today.revenue ?? 0)}
              delta="-"
              icon={Banknote}
            />
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-7 rounded-3xl border border-slate-200/70 bg-white/70 shadow-sm backdrop-blur-lg transition-all duration-200 hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-slate-900">Progress</CardTitle>
              <CardDescription className="text-slate-600">
                Weekly service activity
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setChartMode("services")}
                className={cn(
                  "rounded-full border px-3 py-2 text-xs font-semibold transition-all duration-200",
                  chartMode === "services"
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100",
                )}
              >
                Services
              </button>
              <button
                type="button"
                onClick={() => setChartMode("revenue")}
                className={cn(
                  "rounded-full border px-3 py-2 text-xs font-semibold transition-all duration-200",
                  chartMode === "revenue"
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100",
                )}
              >
                Revenue
              </button>
            </div>
          </CardHeader>

          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 16, left: -12, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="fillOrange" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  stroke="#64748b"
                  fontSize={12}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  stroke="#64748b"
                  fontSize={12}
                  tickFormatter={(v) => {
                    if (chartMode === "revenue") {
                      return new Intl.NumberFormat("id-ID", {
                        notation: "compact",
                        maximumFractionDigits: 1,
                      }).format(Number(v));
                    }
                    return String(v);
                  }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 16,
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey={chartMode}
                  stroke="#0f172a"
                  strokeWidth={2}
                  fill="url(#fillOrange)"
                  dot={false}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-5 rounded-3xl border border-slate-200/70 bg-white/70 shadow-sm backdrop-blur-lg transition-all duration-200 hover:shadow-md">
          <CardHeader>
            <CardTitle className="text-slate-900">Status WO</CardTitle>
            <CardDescription className="text-slate-600">Ringkasan antrian hari ini</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-3xl border border-slate-200/70 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-700">Proses</p>
                <p className="text-xl font-semibold text-slate-900">
                  {dashboardQuery.isLoading ? "-" : String(data?.status.proses ?? 0)}
                </p>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div className="h-full w-[60%] rounded-full bg-amber-300" />
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200/70 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-700">Antrian</p>
                <p className="text-xl font-semibold text-slate-900">
                  {dashboardQuery.isLoading ? "-" : String(data?.status.antrian ?? 0)}
                </p>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div className="h-full w-[35%] rounded-full bg-slate-900" />
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200/70 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-700">Selesai</p>
                <p className="text-xl font-semibold text-slate-900">
                  {dashboardQuery.isLoading ? "-" : String(completedCount)}
                </p>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div className="h-full w-[80%] rounded-full bg-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-8 rounded-3xl border border-slate-200/70 bg-white/70 shadow-sm backdrop-blur-lg transition-all duration-200 hover:shadow-md">
          <CardHeader>
            <CardTitle className="text-slate-900">Recent Transactions</CardTitle>
            <CardDescription className="text-slate-600">
              Latest payments and invoices
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-3xl border border-slate-200/70 bg-white">
              <div className="hidden grid-cols-12 bg-slate-50 px-5 py-3 text-xs font-semibold text-slate-600 sm:grid">
                <div className="col-span-3">Transaction</div>
                <div className="col-span-3">Customer</div>
                <div className="col-span-3">Vehicle</div>
                <div className="col-span-2">Amount</div>
                <div className="col-span-1 text-right">Status</div>
              </div>

              {(data?.recent ?? []).map((t) => {
                const customerName = t.customer?.name ?? "-";
                const vehicleLabel = t.vehicle?.plateNumber ?? "-";
                const serviceLabel = `${t.vehicle?.brand ?? ""} ${t.vehicle?.model ?? ""}`.trim();
                return (
                  <div key={t.id} className="border-t border-slate-100">
                    <div className="hidden grid-cols-12 items-center px-5 py-3 text-sm text-slate-700 transition-all duration-200 hover:bg-slate-50 sm:grid">
                      <div className="col-span-3">
                        <p className="font-semibold text-slate-900">{t.woNumber}</p>
                        <p className="text-xs text-slate-500">{serviceLabel || "-"}</p>
                      </div>
                      <div className="col-span-3 text-slate-900">{customerName}</div>
                      <div className="col-span-3 text-slate-600">{vehicleLabel}</div>
                      <div className="col-span-2 font-medium text-slate-900">
                        {formatRupiah(t.grandTotal ?? 0)}
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <StatusPill status={String(t.status)} />
                      </div>
                    </div>

                    <div className="p-4 sm:hidden">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{customerName}</p>
                          <p className="mt-1 text-xs text-slate-500">{vehicleLabel}</p>
                          <p className="mt-2 text-xs text-slate-600">{t.woNumber}</p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <StatusPill status={String(t.status)} />
                          <p className="text-sm font-semibold text-slate-900">
                            {formatRupiah(t.grandTotal ?? 0)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:col-span-4" />
      </section>
    </div>
  );
}

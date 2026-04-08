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
  CircleCheck,
  ClipboardCheck,
  Gauge,
  Play,
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
import { cn } from "~/lib/utils";

type ServiceDatum = {
  name: string;
  services: number;
  revenue: number;
};

const serviceData: ServiceDatum[] = [
  { name: "Mon", services: 18, revenue: 12 },
  { name: "Tue", services: 24, revenue: 18 },
  { name: "Wed", services: 20, revenue: 14 },
  { name: "Thu", services: 32, revenue: 26 },
  { name: "Fri", services: 28, revenue: 22 },
  { name: "Sat", services: 36, revenue: 30 },
  { name: "Sun", services: 14, revenue: 9 },
];

const recentTransactions = [
  {
    id: "TRX-10241",
    customer: "Andi Pratama",
    vehicle: "Toyota Avanza",
    service: "Oil Change + Inspection",
    amount: "Rp 450.000",
    status: "Paid",
  },
  {
    id: "TRX-10240",
    customer: "Siti Rahma",
    vehicle: "Honda Brio",
    service: "Brake Service",
    amount: "Rp 680.000",
    status: "Pending",
  },
  {
    id: "TRX-10239",
    customer: "Budi Santoso",
    vehicle: "Mitsubishi Xpander",
    service: "AC Service",
    amount: "Rp 520.000",
    status: "Paid",
  },
  {
    id: "TRX-10238",
    customer: "Rina Putri",
    vehicle: "Suzuki Ertiga",
    service: "Tune Up",
    amount: "Rp 750.000",
    status: "In Review",
  },
] as const;

const technicianPerformance = [
  { name: "Rafi", jobs: 12, rating: 4.8, onTime: "96%" },
  { name: "Dimas", jobs: 9, rating: 4.6, onTime: "92%" },
  { name: "Agus", jobs: 14, rating: 4.7, onTime: "95%" },
] as const;

const upcomingBookings = [
  { time: "10:00", customer: "Fajar", vehicle: "Daihatsu Xenia", job: "Periodic Service" },
  { time: "11:30", customer: "Nina", vehicle: "Toyota Rush", job: "Tire Rotation" },
  { time: "13:00", customer: "Rio", vehicle: "Honda HR-V", job: "Brake Check" },
] as const;

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
    status === "Paid"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : status === "Pending"
        ? "bg-orange-50 text-orange-700 border-orange-200"
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
                <p className="mt-2 text-2xl font-semibold text-slate-900">6</p>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full w-[66%] rounded-full bg-amber-300" />
                </div>
              </div>
              <div className="rounded-3xl border border-slate-200/70 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium text-slate-500">Queue</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">7</p>
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
            <SummaryCard title="Total Customers" value="1,284" delta="+12%" icon={Users} />
            <SummaryCard title="Total Vehicles" value="2,031" delta="+9%" icon={Car} />
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <SummaryCard title="Today Services" value="38" delta="+18%" icon={Wrench} />
            <SummaryCard title="Revenue" value="Rp 24,8 jt" delta="+21%" icon={Banknote} />
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
                data={serviceData}
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
            <CardTitle className="text-slate-900">Time tracker</CardTitle>
            <CardDescription className="text-slate-600">
              Current focus timer
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">Work time</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-900">02:35</p>
                </div>
                <button
                  type="button"
                  className="grid h-12 w-12 place-items-center rounded-full bg-slate-900 text-white shadow-sm transition-all duration-200 hover:scale-[1.02]"
                  aria-label="Play"
                >
                  <Play className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div className="h-full w-[58%] rounded-full bg-amber-300" />
              </div>
              <p className="mt-2 text-xs text-slate-500">Target: 04:30</p>
            </div>

            <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Onboarding</p>
                  <p className="mt-1 text-xs text-slate-500">Tasks completed</p>
                </div>
                <div className="rounded-full bg-amber-200/60 px-3 py-1 text-xs font-semibold text-slate-900">
                  2/8
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {["Setup service catalog", "Add first customer", "Create service order"].map((t, idx) => (
                  <div key={t} className="flex items-center justify-between rounded-2xl border border-slate-200/70 bg-slate-50 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <CircleCheck className={cn("h-4 w-4", idx === 0 ? "text-emerald-600" : "text-slate-400")} />
                      <p className="text-sm text-slate-700">{t}</p>
                    </div>
                    <span className="text-xs text-slate-500">{idx === 0 ? "Done" : "Todo"}</span>
                  </div>
                ))}
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

              {recentTransactions.map((t) => (
                <div key={t.id} className="border-t border-slate-100">
                  <div className="hidden grid-cols-12 items-center px-5 py-3 text-sm text-slate-700 transition-all duration-200 hover:bg-slate-50 sm:grid">
                    <div className="col-span-3">
                      <p className="font-semibold text-slate-900">{t.id}</p>
                      <p className="text-xs text-slate-500">{t.service}</p>
                    </div>
                    <div className="col-span-3 text-slate-900">{t.customer}</div>
                    <div className="col-span-3 text-slate-600">{t.vehicle}</div>
                    <div className="col-span-2 font-medium text-slate-900">{t.amount}</div>
                    <div className="col-span-1 flex justify-end">
                      <StatusPill status={t.status} />
                    </div>
                  </div>

                  <div className="p-4 sm:hidden">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{t.customer}</p>
                        <p className="mt-1 text-xs text-slate-500">{t.vehicle}</p>
                        <p className="mt-2 text-xs text-slate-600">{t.service}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <StatusPill status={t.status} />
                        <p className="text-sm font-semibold text-slate-900">{t.amount}</p>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-slate-400">{t.id}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:col-span-4">
          <Card className="rounded-3xl border border-slate-200/70 bg-white/70 shadow-sm backdrop-blur-lg transition-all duration-200 hover:shadow-md">
            <CardHeader>
              <CardTitle className="text-slate-900">Vehicle Status</CardTitle>
              <CardDescription className="text-slate-600">
                Current queue overview
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-3xl border border-slate-200/70 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-700">In Service</p>
                  <p className="text-xl font-semibold text-slate-900">12</p>
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full w-[60%] rounded-full bg-amber-300" />
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200/70 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-700">Waiting</p>
                  <p className="text-xl font-semibold text-slate-900">7</p>
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full w-[35%] rounded-full bg-slate-900" />
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200/70 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-700">Completed</p>
                  <p className="text-xl font-semibold text-slate-900">19</p>
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full w-[80%] rounded-full bg-emerald-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border border-slate-200/70 bg-white/70 shadow-sm backdrop-blur-lg transition-all duration-200 hover:shadow-md">
            <CardHeader>
              <CardTitle className="text-slate-900">Upcoming</CardTitle>
              <CardDescription className="text-slate-600">
                Next bookings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {upcomingBookings.map((b) => (
                <div
                  key={`${b.time}-${b.customer}`}
                  className="flex items-start gap-3 rounded-3xl border border-slate-200/70 bg-white p-4 shadow-sm transition-all duration-200 hover:shadow-md"
                >
                  <div className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-200/60 text-slate-900">
                    <ClipboardCheck className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {b.customer}
                      </p>
                      <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white">
                        {b.time}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">{b.vehicle}</p>
                    <p className="mt-1 text-xs font-medium text-slate-900">{b.job}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-6 rounded-3xl border border-slate-200/70 bg-white/70 shadow-sm backdrop-blur-lg transition-all duration-200 hover:shadow-md">
          <CardHeader>
            <CardTitle className="text-slate-900">Technician Performance</CardTitle>
            <CardDescription className="text-slate-600">
              Weekly efficiency snapshot
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {technicianPerformance.map((t) => (
              <div
                key={t.name}
                className="rounded-3xl border border-slate-200/70 bg-white p-4 shadow-sm transition-all duration-200 hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{t.name}</p>
                    <p className="text-xs text-slate-600">Jobs completed: {t.jobs}</p>
                  </div>
                  <div className="rounded-full bg-amber-200/60 px-3 py-1 text-xs font-semibold text-slate-900">
                    {t.rating}★
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
                  <span>On-time</span>
                  <span className="font-semibold text-slate-900">{t.onTime}</span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full w-[90%] rounded-full bg-amber-300" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-6 rounded-3xl border border-slate-200/70 bg-white/70 shadow-sm backdrop-blur-lg transition-all duration-200 hover:shadow-md">
          <CardHeader>
            <CardTitle className="text-slate-900">Notes</CardTitle>
            <CardDescription className="text-slate-600">
              Quick actions for the team
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md">
              <p className="text-sm font-semibold text-slate-900">Priority queue</p>
              <p className="mt-1 text-sm text-slate-600">
                Review waiting vehicles and assign technician.
              </p>
              <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div className="h-full w-[45%] rounded-full bg-slate-900" />
              </div>
            </div>
            <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md">
              <p className="text-sm font-semibold text-slate-900">Parts checklist</p>
              <p className="mt-1 text-sm text-slate-600">
                Ensure spare parts stock for upcoming services.
              </p>
              <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div className="h-full w-[72%] rounded-full bg-amber-300" />
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

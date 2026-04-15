"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import * as React from "react";
import { createPortal } from "react-dom";

import {
  BarChart3,
  Bell,
  Car,
  ChevronDown,
  Contact,
  MessageCircle,
  LayoutDashboard,
  Settings,
  X,
  Users,
  Tags,
  Wrench,
} from "lucide-react";

import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

function normalizePhoneForWa(phone: string) {
  const trimmed = phone.trim();
  if (!trimmed) return "";
  const digits = trimmed.replace(/[^0-9+]/g, "");
  if (digits.startsWith("+")) return digits.slice(1);
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("62")) return digits;
  return digits;
}

const MANAGEMENT_ITEMS = [
  { href: "/admin/rbac", label: "Manajemen Akses", icon: Users },
  { href: "/admin/product", label: "Product", icon: Tags },
  { href: "/admin/stock-in", label: "Stock In", icon: Tags },
  { href: "/admin/brands", label: "Brand", icon: Car },
  { href: "/admin/users", label: "User", icon: Users },
  { href: "/admin/employees", label: "Pegawai", icon: Users },
  { href: "/admin/kategori", label: "Kategori", icon: Tags },
] as const;

const CUSTOMER_ITEMS = [
  { href: "/admin/customer", label: "List Customers", icon: Contact },
  {
    href: "/admin/customer/birthday-reminder",
    label: "Birthday Reminder",
    icon: Bell,
  },
  {
    href: "/admin/customer/service-reminder",
    label: "Service Reminder",
    icon: Bell,
  },
] as const;

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/reports", label: "Reports", icon: BarChart3 },
  { href: "/admin/service", label: "Transaksi", icon: Wrench },
] as const;

function getTitleFromPath(pathname: string) {
  const match = NAV_ITEMS.find((i) => i.href === pathname);
  if (match) return match.label;
  if (pathname.startsWith("/admin/rbac")) return "Manajemen Akses";
  if (pathname.startsWith("/admin/product")) return "Product";
  if (pathname.startsWith("/admin/stock-in")) return "Stock In";
  if (pathname.startsWith("/admin/brands")) return "Brand";
  if (pathname.startsWith("/admin/users")) return "User";
  if (pathname.startsWith("/admin/employees")) return "Pegawai";
  if (pathname.startsWith("/admin/kategori")) return "Kategori";
  if (pathname.startsWith("/admin/customer/birthday-reminder"))
    return "Birthday Reminder";
  if (pathname.startsWith("/admin/customer/service-reminder"))
    return "Service Reminder";
  if (pathname.startsWith("/admin/customer")) return "Customers";
  if (pathname.startsWith("/admin/reports")) return "Reports";
  if (pathname.startsWith("/admin/service")) return "Transaksi";
  return "Dashboard";
}

export default function AdminShell({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const profileMenuRef = React.useRef<HTMLDetailsElement>(null);
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  const utils = api.useUtils();
  const followUpBirthdayReminderMutation = api.admin.followUpBirthdayReminder.useMutation({
    onSuccess: async () => {
      await utils.admin.getHeaderNotifications.invalidate();
    },
  });
  const snoozeBirthdayReminderMutation = api.admin.snoozeBirthdayReminder.useMutation({
    onSuccess: async () => {
      await utils.admin.getHeaderNotifications.invalidate();
    },
  });
  const followUpServiceReminderMutation = api.admin.followUpServiceReminder.useMutation({
    onSuccess: async () => {
      await utils.admin.getHeaderNotifications.invalidate();
    },
  });
  const snoozeServiceReminderMutation = api.admin.snoozeServiceReminder.useMutation({
    onSuccess: async () => {
      await utils.admin.getHeaderNotifications.invalidate();
    },
  });

  const notifQuery = api.admin.getHeaderNotifications.useQuery(undefined, {
    retry: false,
    refetchInterval: 60_000,
  });

  const notifTotal = React.useMemo(() => {
    const birthdays = notifQuery.data?.birthdays ?? [];
    const service = notifQuery.data?.service ?? [];
    return birthdays.length + service.length;
  }, [notifQuery.data?.birthdays, notifQuery.data?.service]);
  const [managementOpen, setManagementOpen] = React.useState(false);
  const managementButtonRef = React.useRef<HTMLButtonElement>(null);
  const managementMenuRef = React.useRef<HTMLDivElement>(null);
  const managementCloseTimeoutRef = React.useRef<number | null>(null);
  const [managementPos, setManagementPos] = React.useState<{
    left: number;
    top: number;
    width: number;
  } | null>(null);

  const [customersOpen, setCustomersOpen] = React.useState(false);
  const customersButtonRef = React.useRef<HTMLButtonElement>(null);
  const customersMenuRef = React.useRef<HTMLDivElement>(null);
  const customersCloseTimeoutRef = React.useRef<number | null>(null);
  const [customersPos, setCustomersPos] = React.useState<{
    left: number;
    top: number;
    width: number;
  } | null>(null);

  const title = getTitleFromPath(pathname);

  React.useEffect(() => {
    setMounted(true);
    setManagementOpen(false);
    setCustomersOpen(false);
    setNotifOpen(false);
  }, [pathname]);

  const cancelManagementClose = React.useCallback(() => {
    if (managementCloseTimeoutRef.current) {
      window.clearTimeout(managementCloseTimeoutRef.current);
      managementCloseTimeoutRef.current = null;
    }
  }, []);

  const scheduleManagementClose = React.useCallback(() => {
    cancelManagementClose();
    managementCloseTimeoutRef.current = window.setTimeout(() => {
      setManagementOpen(false);
    }, 150);
  }, [cancelManagementClose]);

  const cancelCustomersClose = React.useCallback(() => {
    if (customersCloseTimeoutRef.current) {
      window.clearTimeout(customersCloseTimeoutRef.current);
      customersCloseTimeoutRef.current = null;
    }
  }, []);

  const scheduleCustomersClose = React.useCallback(() => {
    cancelCustomersClose();
    customersCloseTimeoutRef.current = window.setTimeout(() => {
      setCustomersOpen(false);
    }, 150);
  }, [cancelCustomersClose]);

  React.useEffect(() => {
    if (!managementOpen) return;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;

      if (managementButtonRef.current?.contains(target)) return;
      if (managementMenuRef.current?.contains(target)) return;

      setManagementOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [managementOpen]);

  React.useLayoutEffect(() => {
    if (!customersOpen) return;

    const el = customersButtonRef.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      setCustomersPos({
        left: rect.left,
        top: rect.bottom,
        width: rect.width,
      });
    };

    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [customersOpen]);

  React.useEffect(() => {
    if (!customersOpen) return;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;

      if (customersButtonRef.current?.contains(target)) return;
      if (customersMenuRef.current?.contains(target)) return;

      setCustomersOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [customersOpen]);

  React.useLayoutEffect(() => {
    if (!managementOpen) return;

    const el = managementButtonRef.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      setManagementPos({
        left: rect.left,
        top: rect.bottom,
        width: rect.width,
      });
    };

    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [managementOpen]);

  return (
    <div className="min-h-screen bg-[#f6f1e8]">
      <div className="mx-auto w-full max-w-[1200px] px-4 py-4 lg:px-6 lg:py-6">
        {mounted && notifOpen
          ? createPortal(
              <div className="fixed inset-0 z-50">
                <button
                  type="button"
                  className={cn(
                    "absolute inset-0 bg-black/30 backdrop-blur-sm",
                    "animate-in fade-in duration-200",
                  )}
                  aria-label="Close notifications"
                  onClick={() => setNotifOpen(false)}
                />

                <div
                  role="dialog"
                  aria-modal="true"
                  className={cn(
                    "absolute right-0 top-0 h-full w-full max-w-md",
                    "border-l border-slate-200 bg-white shadow-2xl",
                    "animate-in slide-in-from-right duration-200",
                  )}
                >
                  <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-slate-900">Notifikasi</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Total: {String(notifTotal)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      aria-label="Close"
                      onClick={() => setNotifOpen(false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="h-[calc(100%-72px)] overflow-y-auto p-5">
                    <div className="space-y-5">
                      <section className="space-y-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Birthday hari ini
                        </p>

                        {(notifQuery.data?.birthdays ?? []).map((b) => {
                            const wa = normalizePhoneForWa(b.phone);
                            return (
                              <div
                                key={b.reminderId}
                                className={cn(
                                  "relative overflow-hidden rounded-3xl border p-4 shadow-sm",
                                  "border-amber-200/70 bg-linear-to-br from-amber-50 to-white",
                                )}
                              >
                                <div className="absolute left-0 top-0 h-full w-1 bg-amber-400/70" />
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                                      Birthday
                                    </span>
                                    <p className="truncate text-sm font-semibold text-slate-900">
                                      {b.name}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-600">{b.phone}</p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      size="icon"
                                      title="Follow up via WhatsApp"
                                      aria-label="Follow up"
                                      disabled={!wa}
                                      onClick={async () => {
                                        if (!wa) return;
                                        await followUpBirthdayReminderMutation.mutateAsync({
                                          reminderId: b.reminderId,
                                        });
                                        const text = `Halo ${b.name}, selamat ulang tahun 🎉\nSemoga sehat & sukses selalu.\n\nJika ingin booking service, kami siap membantu. Terima kasih.`;
                                        window.open(
                                          `https://wa.me/${wa}?text=${encodeURIComponent(text)}`,
                                          "_blank",
                                          "noopener,noreferrer",
                                        );
                                      }}
                                    >
                                      <MessageCircle className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      size="icon"
                                      title="Snooze"
                                      aria-label="Snooze"
                                      onClick={async () => {
                                        await snoozeBirthdayReminderMutation.mutateAsync({
                                          reminderId: b.reminderId,
                                        });
                                      }}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}

                        {(notifQuery.data?.birthdays ?? []).length === 0 && (
                          <p className="text-sm text-slate-600">Tidak ada ulang tahun hari ini.</p>
                        )}
                      </section>

                      <section className="space-y-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Service reminder
                        </p>

                        {(notifQuery.data?.service ?? []).map((s) => {
                            const name = s.customer?.name ?? "-";
                            const phone = s.customer?.phone ?? "";
                            const wa = normalizePhoneForWa(phone);
                            const plate = s.vehicle?.plateNumber ?? "-";
                            const vehicleLabel = `${s.vehicle?.brand ?? ""} ${s.vehicle?.model ?? ""}`.trim();
                            return (
                              <div
                                key={s.reminderId}
                                className={cn(
                                  "relative overflow-hidden rounded-3xl border p-4 shadow-sm",
                                  "border-sky-200/70 bg-linear-to-br from-sky-50 to-white",
                                )}
                              >
                                <div className="absolute left-0 top-0 h-full w-1 bg-sky-400/70" />
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <span className="inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-800">
                                      Service
                                    </span>
                                    <p className="truncate text-sm font-semibold text-slate-900">
                                      {name}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-600">{phone || "-"}</p>
                                    <p className="mt-2 text-xs font-semibold text-slate-900">
                                      {plate}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-600">{vehicleLabel || "-"}</p>
                                    <p className="mt-2 text-xs text-slate-500">WO terakhir: {s.woNumber}</p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      size="icon"
                                      title="Follow up via WhatsApp"
                                      aria-label="Follow up"
                                      disabled={!wa}
                                      onClick={async () => {
                                        if (!wa) return;
                                        await followUpServiceReminderMutation.mutateAsync({
                                          reminderId: s.reminderId,
                                        });
                                        const text = `Halo ${name},\n\nKami ingatkan jadwal service kendaraan ${plate}.\nSilakan balas chat ini untuk booking service.\n\nTerima kasih.`;
                                        window.open(
                                          `https://wa.me/${wa}?text=${encodeURIComponent(text)}`,
                                          "_blank",
                                          "noopener,noreferrer",
                                        );
                                      }}
                                    >
                                      <MessageCircle className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      size="icon"
                                      title="Snooze"
                                      aria-label="Snooze"
                                      onClick={async () => {
                                        await snoozeServiceReminderMutation.mutateAsync({
                                          reminderId: s.reminderId,
                                        });
                                      }}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}

                        {(notifQuery.data?.service ?? []).length === 0 && (
                          <p className="text-sm text-slate-600">Tidak ada reminder service hari ini.</p>
                        )}
                      </section>
                    </div>
                  </div>
                </div>
              </div>,
              document.body,
            )
          : null}

        <header className="sticky top-0 z-40 print:hidden">
          <div className="rounded-3xl border border-slate-200/70 bg-white/60 shadow-sm backdrop-blur-lg">
            <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">BengkelAsia</p>
                  <p className="text-xs text-slate-500">{title}</p>
                </div>

                <div className="flex items-center gap-2 sm:hidden">
                  <Button
                    variant="secondary"
                    size="icon"
                    className="relative"
                    aria-label="Notifications"
                    onClick={() => setNotifOpen(true)}
                  >
                    <Bell className="h-5 w-5" />
                    {notifTotal > 0 ? (
                      <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-orange-500 px-1 text-[10px] font-semibold text-white">
                        {notifTotal > 99 ? "99+" : String(notifTotal)}
                      </span>
                    ) : null}
                  </Button>
                </div>
              </div>

              <nav
                aria-label="Admin navigation"
                className={cn(
                  "rounded-full border border-slate-200 bg-white px-2 py-1 shadow-sm",
                  "overflow-visible",
                )}
              >
                <div
                  className={cn(
                    "flex items-center gap-1",
                    "overflow-x-auto overflow-y-visible whitespace-nowrap [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                  )}
                >
                  {(() => {
                    const dashboardActive = pathname === "/admin";
                    const managementActive = MANAGEMENT_ITEMS.some(
                      (i) => pathname === i.href || pathname.startsWith(`${i.href}/`),
                    );
                    const customersActive = CUSTOMER_ITEMS.some(
                      (i) => pathname === i.href || pathname.startsWith(`${i.href}/`),
                    );
                    const reportsActive =
                      pathname === "/admin/reports" ||
                      pathname.startsWith("/admin/reports/");
                    const transaksiActive =
                      pathname === "/admin/service" || pathname.startsWith("/admin/service/");

                    return (
                      <>
                        <Link
                          href="/admin"
                          aria-current={dashboardActive ? "page" : undefined}
                          className={cn(
                            "inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition-all duration-200",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400",
                            dashboardActive
                              ? "bg-slate-900 text-white"
                              : "text-slate-700 hover:bg-slate-100",
                          )}
                        >
                          <LayoutDashboard
                            className={cn(
                              "hidden h-3.5 w-3.5 sm:block",
                              dashboardActive ? "text-white" : "text-slate-500",
                            )}
                          />
                          Dashboard
                        </Link>

                        <div
                          className="relative"
                          onMouseEnter={() => {
                            cancelManagementClose();
                            setManagementOpen(true);
                          }}
                          onMouseLeave={() => {
                            scheduleManagementClose();
                          }}
                        >
                          <button
                            ref={managementButtonRef}
                            type="button"
                            className={cn(
                              "inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition-all duration-200",
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400",
                              managementActive
                                ? "bg-slate-900 text-white"
                                : "text-slate-700 hover:bg-slate-100",
                            )}
                            aria-haspopup="menu"
                            aria-expanded={managementOpen}
                            onClick={() => setManagementOpen((v) => !v)}
                          >
                            Manajemen Data
                            <ChevronDown
                              className={cn(
                                "h-4 w-4 transition-transform duration-200",
                                managementActive ? "text-white/80" : "text-slate-500",
                                managementOpen ? "rotate-180" : "rotate-0",
                              )}
                              aria-hidden="true"
                            />
                          </button>
                        </div>

                        <div
                          className="relative"
                          onMouseEnter={() => {
                            cancelCustomersClose();
                            setCustomersOpen(true);
                          }}
                          onMouseLeave={() => {
                            scheduleCustomersClose();
                          }}
                        >
                          <button
                            ref={customersButtonRef}
                            type="button"
                            className={cn(
                              "inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition-all duration-200",
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400",
                              customersActive
                                ? "bg-slate-900 text-white"
                                : "text-slate-700 hover:bg-slate-100",
                            )}
                            aria-haspopup="menu"
                            aria-expanded={customersOpen}
                            onClick={() => setCustomersOpen((v) => !v)}
                          >
                            Customers
                            <ChevronDown
                              className={cn(
                                "h-4 w-4 transition-transform duration-200",
                                customersActive ? "text-white/80" : "text-slate-500",
                                customersOpen ? "rotate-180" : "rotate-0",
                              )}
                              aria-hidden="true"
                            />
                          </button>
                        </div>

                        <Link
                          href="/admin/reports"
                          aria-current={reportsActive ? "page" : undefined}
                          className={cn(
                            "inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition-all duration-200",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400",
                            reportsActive
                              ? "bg-slate-900 text-white"
                              : "text-slate-700 hover:bg-slate-100",
                          )}
                        >
                          <BarChart3
                            className={cn(
                              "hidden h-3.5 w-3.5 sm:block",
                              reportsActive ? "text-white" : "text-slate-500",
                            )}
                            aria-hidden="true"
                          />
                          Reports
                        </Link>

                        <Link
                          href="/admin/service"
                          aria-current={transaksiActive ? "page" : undefined}
                          className={cn(
                            "inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition-all duration-200",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400",
                            transaksiActive
                              ? "bg-slate-900 text-white"
                              : "text-slate-700 hover:bg-slate-100",
                          )}
                        >
                          <Wrench
                            className={cn(
                              "hidden h-3.5 w-3.5 sm:block",
                              transaksiActive ? "text-white" : "text-slate-500",
                            )}
                            aria-hidden="true"
                          />
                          Transaksi
                        </Link>
                      </>
                    );
                  })()}
                </div>
              </nav>

              <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
                <Button
                  variant="secondary"
                  size="icon"
                  className="relative"
                  aria-label="Notifications"
                  onClick={() => setNotifOpen(true)}
                >
                  <Bell className="h-5 w-5" />
                  {notifTotal > 0 ? (
                    <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-orange-500 px-1 text-[10px] font-semibold text-white">
                      {notifTotal > 99 ? "99+" : String(notifTotal)}
                    </span>
                  ) : null}
                </Button>

                <details ref={profileMenuRef} className="group relative">
                  <summary
                    className={cn(
                      "list-none",
                      "cursor-pointer",
                      "flex items-center gap-3 rounded-full border border-slate-200 bg-white px-3 py-2 text-left shadow-sm transition-all duration-200 hover:shadow",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400",
                    )}
                  >
                    <div className="grid h-8 w-8 place-items-center rounded-full bg-slate-900 text-white">
                      <span className="text-xs font-semibold">BA</span>
                    </div>
                    <div className="hidden md:block">
                      <p className="text-sm font-medium text-slate-900">Admin</p>
                      <p className="text-xs text-slate-500">admin@bengkel</p>
                    </div>
                  </summary>

                  <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
                    <div className="p-3">
                      <p className="text-sm font-semibold text-slate-900">Admin</p>
                      <p className="text-xs text-slate-500">Workshop Operator</p>
                    </div>
                    <div className="h-px bg-slate-100" />
                    <div className="p-2">
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-700 transition-all duration-200 hover:bg-slate-50"
                      >
                        <Settings className="h-4 w-4" />
                        Settings
                      </button>
                      <div className="my-2 h-px bg-slate-100" />
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-red-600 transition-all duration-200 hover:bg-red-50"
                        onClick={async () => {
                          profileMenuRef.current?.removeAttribute("open");
                          await signOut({ callbackUrl: "/" });
                        }}
                      >
                        Log out
                      </button>
                    </div>
                  </div>
                </details>
              </div>
            </div>
          </div>
        </header>

        <main className="mt-6">{children}</main>
      </div>

      <ManagementMenuOverlay
        open={managementOpen}
        pos={managementPos}
        menuRef={managementMenuRef}
        pathname={pathname}
        onClose={() => setManagementOpen(false)}
        onMouseEnter={() => {
          cancelManagementClose();
          setManagementOpen(true);
        }}
        onMouseLeave={() => {
          scheduleManagementClose();
        }}
      />

      <MenuOverlay
        items={CUSTOMER_ITEMS}
        open={customersOpen}
        pos={customersPos}
        menuRef={customersMenuRef}
        pathname={pathname}
        onClose={() => setCustomersOpen(false)}
        onMouseEnter={() => {
          cancelCustomersClose();
          setCustomersOpen(true);
        }}
        onMouseLeave={() => {
          scheduleCustomersClose();
        }}
      />
    </div>
  );
}

function MenuOverlay<TItems extends ReadonlyArray<{ href: string; label: string; icon: React.ComponentType<{ className?: string }> }>>({
  items,
  open,
  pos,
  menuRef,
  pathname,
  onClose,
  onMouseEnter,
  onMouseLeave,
}: {
  items: TItems;
  open: boolean;
  pos: { left: number; top: number; width: number } | null;
  menuRef: React.RefObject<HTMLDivElement | null>;
  pathname: string;
  onClose: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  if (!open || !pos) return null;

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      className="fixed z-9999 mt-2 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg"
      style={{ left: pos.left, top: pos.top }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="p-2">
        {items.map((i) => {
          const active = pathname === i.href || pathname.startsWith(`${i.href}/`);
          const Icon = i.icon;
          return (
            <Link
              key={i.href}
              href={i.href}
              role="menuitem"
              className={cn(
                "flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-all duration-200",
                active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-50",
              )}
              onClick={onClose}
            >
              <Icon
                className={cn(
                  "h-4 w-4",
                  active ? "text-white" : "text-slate-500",
                )}
              />
              {i.label}
            </Link>
          );
        })}
      </div>
    </div>,
    document.body,
  );
}

function ManagementMenuOverlay(props: {
  open: boolean;
  pos: { left: number; top: number; width: number } | null;
  menuRef: React.RefObject<HTMLDivElement | null>;
  pathname: string;
  onClose: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  return <MenuOverlay items={MANAGEMENT_ITEMS} {...props} />;
}

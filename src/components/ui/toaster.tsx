"use client";

import * as React from "react";
import { X } from "lucide-react";

import { useToast } from "~/hooks/use-toast";
import { cn } from "~/lib/utils";
import { Button } from "./button";

export function Toaster() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-50 flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2",
      )}
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((t) => {
        const borderClass =
          t.variant === "success"
            ? "border-emerald-200"
            : t.variant === "destructive"
              ? "border-red-200"
              : "border-slate-200";

        const bgClass =
          t.variant === "success"
            ? "bg-emerald-50"
            : t.variant === "destructive"
              ? "bg-red-50"
              : "bg-white";

        return (
          <div
            key={t.id}
            className={cn(
              "rounded-2xl border p-4 shadow-lg",
              "animate-in slide-in-from-bottom-2 fade-in duration-200",
              borderClass,
              bgClass,
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{t.title}</p>
                {t.description ? (
                  <p className="mt-1 line-clamp-2 text-sm text-slate-700">
                    {t.description}
                  </p>
                ) : null}
              </div>

              <Button
                variant="ghost"
                size="icon"
                aria-label="Dismiss"
                className="h-9 w-9"
                onClick={() => dismiss(t.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

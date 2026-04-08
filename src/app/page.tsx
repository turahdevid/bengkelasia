"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  BadgeCheck,
  Clock,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Wrench,
} from "lucide-react";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as React from "react";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { type LoginInput, loginSchema } from "~/lib/validators/auth";

export default function Home() {
  const router = useRouter();
  const [formError, setFormError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    mode: "onChange",
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = handleSubmit(async (values: LoginInput) => {
    setFormError(null);

    const res = await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
    });

    if (!res || res.error) {
      setFormError("Email atau password salah");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  });

  return (
    <main className="min-h-screen bg-zinc-100">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
        <section className="relative order-1 overflow-hidden lg:order-2">
          <div className="absolute inset-0 bg-linear-to-br from-slate-950 via-slate-900 to-orange-500" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.08)_1px,transparent_0)] bg-size-[22px_22px]" />
          <div className="absolute -left-24 -top-24 h-136 w-136 rounded-full bg-orange-500/25 blur-3xl" />
          <div className="absolute -bottom-40 left-1/3 h-160 w-160 rounded-full bg-white/10 blur-3xl" />

          <div className="relative flex min-h-[42vh] items-center px-6 py-10 lg:min-h-screen lg:px-10">
            <div className="w-full">
              <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
                <div className="flex items-center gap-4">
                  <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/10 text-white backdrop-blur-lg">
                    <Wrench className="h-7 w-7" />
                  </div>
                  <div>
                    <p className="text-xl font-semibold text-white">
                      BengkelAsia
                    </p>
                    <p className="text-sm text-white/80">
                      Trusted Car Service & Maintenance
                    </p>
                  </div>
                </div>

                <Card className="bg-white/10 shadow-lg backdrop-blur-lg">
                  <CardHeader>
                    <CardTitle className="text-white">YourWorkshop Logo</CardTitle>
                    <CardDescription className="text-white/80">
                      Professional workshop system for daily operations.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white/20 bg-white/10 p-4 shadow-lg transition-all duration-200 hover:shadow-xl">
                        <p className="text-sm font-medium text-white">
                          Service cepat & profesional
                        </p>
                        <p className="mt-1 text-xs text-white/75">
                          Percepat proses penerimaan hingga selesai.
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/20 bg-white/10 p-4 shadow-lg transition-all duration-200 hover:shadow-xl">
                        <p className="text-sm font-medium text-white">
                          Tracking kendaraan real-time
                        </p>
                        <p className="mt-1 text-xs text-white/75">
                          Status pekerjaan jelas untuk pelanggan.
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/20 bg-white/10 p-4 shadow-lg transition-all duration-200 hover:shadow-xl">
                        <p className="text-sm font-medium text-white">
                          Teknisi berpengalaman
                        </p>
                        <p className="mt-1 text-xs text-white/75">
                          SOP rapi, kualitas terjaga.
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/20 bg-white/10 p-4 shadow-lg transition-all duration-200 hover:shadow-xl">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-white/90">
                            <MapPin className="h-4 w-4" />
                            <span className="text-sm font-medium">Jakarta</span>
                          </div>
                          <div className="flex items-center gap-2 text-white/90">
                            <Clock className="h-4 w-4" />
                            <span className="text-sm font-medium">09:00</span>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-orange-400" />
                          <span className="text-xs font-medium text-white/90">
                            Status: Open
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        <section className="order-2 flex items-center justify-center px-4 py-12 lg:order-1">
          <div className="w-full max-w-md">
            <Card className="bg-white/30 shadow-lg backdrop-blur-lg">
              <CardHeader>
                <CardTitle className="text-slate-900">Welcome Back</CardTitle>
                <CardDescription className="text-slate-700">
                  Login to manage your workshop
                </CardDescription>
              </CardHeader>

              <CardContent>
                <form className="space-y-5" onSubmit={onSubmit}>
                  <div className="space-y-2">
                    <label
                      htmlFor="email"
                      className="text-sm font-medium text-slate-900"
                    >
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      <Input
                        id="email"
                        type="email"
                        autoComplete="email"
                        placeholder="you@workshop.com"
                        className="h-12 bg-white pl-10 text-slate-900 placeholder:text-slate-400 ring-offset-white focus-visible:ring-orange-400"
                        aria-invalid={!!errors.email}
                        {...register("email")}
                      />
                    </div>
                    {errors.email?.message ? (
                      <p className="text-sm text-red-600">{errors.email.message}</p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="password"
                        className="text-sm font-medium text-slate-900"
                      >
                        Password
                      </label>
                      <Link
                        href="#"
                        className="text-sm font-medium text-orange-600 underline-offset-4 transition-all duration-200 hover:underline"
                      >
                        Forgot password?
                      </Link>
                    </div>

                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      <Input
                        id="password"
                        type="password"
                        autoComplete="current-password"
                        placeholder="••••••••"
                        className="h-12 bg-white pl-10 text-slate-900 placeholder:text-slate-400 ring-offset-white focus-visible:ring-orange-400"
                        aria-invalid={!!errors.password}
                        {...register("password")}
                      />
                    </div>
                    {errors.password?.message ? (
                      <p className="text-sm text-red-600">
                        {errors.password.message}
                      </p>
                    ) : null}
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    className="h-12 w-full bg-orange-500 font-medium text-white transition-all duration-200 hover:bg-orange-600 hover:scale-[1.02]"
                    disabled={!isValid || isSubmitting}
                    aria-busy={isSubmitting}
                  >
                    {isSubmitting ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Signing in...
                      </span>
                    ) : (
                      "Sign in"
                    )}
                  </Button>

                  <div
                    className={
                      formError
                        ? "rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 opacity-100 transition-all duration-200"
                        : "pointer-events-none h-0 overflow-hidden opacity-0"
                    }
                    role="status"
                    aria-live="polite"
                  >
                    {formError}
                  </div>
                </form>
              </CardContent>

              <CardFooter>
                <div className="flex w-full items-start gap-2 rounded-2xl border border-white/20 bg-white/40 p-4">
                  <BadgeCheck className="mt-0.5 h-4 w-4 text-orange-500" />
                  <p className="text-xs text-slate-600">
                    By signing in, you agree to our{` `}
                    <Link
                      href="#"
                      className="font-medium text-slate-900 underline-offset-4 transition-all duration-200 hover:underline"
                    >
                      Terms
                    </Link>
                    {` `}and{` `}
                    <Link
                      href="#"
                      className="font-medium text-slate-900 underline-offset-4 transition-all duration-200 hover:underline"
                    >
                      Privacy Policy
                    </Link>
                    .
                  </p>
                </div>
              </CardFooter>
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
}

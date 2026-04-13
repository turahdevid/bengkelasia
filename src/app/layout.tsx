import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";

import { Toaster } from "~/components/ui/toaster";
import { ToastProvider } from "~/hooks/use-toast";
import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
  title: "BengkelAsia",
  description: "Workshop management system",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable}`}>
      <body className="min-h-screen bg-slate-100 text-slate-900 antialiased">
        <ToastProvider>
          <TRPCReactProvider>
            {children}
            <Toaster />
          </TRPCReactProvider>
        </ToastProvider>
      </body>
    </html>
  );
}

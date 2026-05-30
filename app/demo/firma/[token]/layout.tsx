"use client";

import Link from "next/link";
import { META } from "@/lib/i18n/labels";

export default function SignerFlowLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-background">
      <header className="px-6 pt-6">
        <Link
          href="/"
          className="inline-block text-base font-bold tracking-tight text-primary"
          aria-label={META.siteName}
        >
          VeraDoc
          <span className="text-accent">.pe</span>
        </Link>
      </header>
      <main className="mx-auto w-full max-w-md px-6 pb-12 pt-4">{children}</main>
    </div>
  );
}

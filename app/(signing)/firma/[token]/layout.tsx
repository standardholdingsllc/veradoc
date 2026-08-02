import Link from "next/link";
import { META } from "@/lib/i18n/labels";
import { resolveSigningContext } from "@/lib/signing/resolve-context";
import { SigningContextProvider } from "@/components/signing/production-context";
import { SigningTokenError } from "./signing-token-error";

export default async function SigningFlowLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await resolveSigningContext(token);

  return (
    <div className="min-h-screen bg-background">
      <header className="px-6 pt-6">
        <Link
          href="/"
          className="inline-block text-base font-bold text-primary"
          aria-label={META.siteName}
        >
          VeraDoc
          <span className="text-accent">.pe</span>
        </Link>
      </header>
      <main className="mx-auto w-full max-w-md px-6 pb-12 pt-4">
        {result.ok ? (
          <SigningContextProvider value={result.data}>
            {children}
          </SigningContextProvider>
        ) : (
          <SigningTokenError error={result.error} />
        )}
      </main>
    </div>
  );
}

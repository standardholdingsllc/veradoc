import { Toaster } from "sonner";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen flex-col">
      <Toaster position="top-right" richColors closeButton />
      <main className="flex-1">{children}</main>
    </div>
  );
}

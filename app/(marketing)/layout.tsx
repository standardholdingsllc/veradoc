import { Footer } from "@/components/layout/footer";
import { TopNav } from "@/components/layout/top-nav";

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen flex-col">
      <TopNav />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

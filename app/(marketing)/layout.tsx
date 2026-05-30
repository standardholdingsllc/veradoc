import { Footer } from "@/components/layout/footer";
import { PaperParallax } from "@/components/layout/paper-parallax";
import { TopNav } from "@/components/layout/top-nav";

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="paper-site flex min-h-screen flex-col">
      <PaperParallax />
      <TopNav />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

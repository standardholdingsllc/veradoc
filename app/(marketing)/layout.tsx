import { Footer } from "@/components/layout/footer";
import { PaperParallax } from "@/components/layout/paper-parallax";
import { TopNav } from "@/components/layout/top-nav";
import { buildAbsoluteUrl } from "@/lib/routing/origins";

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="paper-site flex min-h-screen flex-col">
      <PaperParallax />
      <TopNav demoUrl={buildAbsoluteUrl({ surface: "demo", path: "/" })} />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

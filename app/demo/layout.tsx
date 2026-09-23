import { notFound } from "next/navigation";
import { DemoShell } from "@/components/layout/demo-shell";
import { getDemoControlState } from "@/lib/demo/repository";

export const dynamic = "force-dynamic";

export default async function DemoLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  try {
    if (!(await getDemoControlState()).enabled) notFound();
  } catch {
    notFound();
  }
  return <DemoShell>{children}</DemoShell>;
}

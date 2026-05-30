import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VeraDoc.pe — Certificación de arrendamiento con revisión notarial",
  description:
    "Flujos de certificación de arrendamiento remoto para el sector inmobiliario peruano. Paquetes de evidencia notarial estructurados para revisión y certificación.",
  openGraph: {
    title: "VeraDoc.pe — Certificación de arrendamiento con revisión notarial",
    description:
      "Flujos de certificación de arrendamiento remoto para el sector inmobiliario peruano.",
    locale: "es_PE",
    type: "website",
    siteName: "VeraDoc.pe",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen bg-background text-foreground font-sans antialiased">
        {children}
      </body>
    </html>
  );
}

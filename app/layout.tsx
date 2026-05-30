import type { Metadata } from "next";
import { JetBrains_Mono, Source_Sans_3, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  display: "swap",
});

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "VeraDoc.pe — Certificación de arrendamiento con revisión notarial",
  description:
    "Flujos de certificación de arrendamiento remoto para el sector inmobiliario peruano. Paquetes de evidencia notarial estructurados para revisión y certificación.",
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/brand/apple-icon.png",
  },
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
    <html
      lang="es"
      className={`${sourceSerif.variable} ${sourceSans.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen bg-background text-foreground font-sans antialiased">
        {children}
      </body>
    </html>
  );
}

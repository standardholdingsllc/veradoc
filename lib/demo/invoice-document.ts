import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import type { LeasePacket } from "@/lib/domain/types";

function pdfText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, " ")
    .slice(0, 110);
}

export async function createDemoInvoiceDocument(packet: LeasePacket): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  document.setTitle(`Muestra de comprobante demo ${packet.packetCode}`);
  document.setSubject("Muestra simulada sin validez tributaria");

  const page = document.addPage([612, 792]);
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const italic = await document.embedFont(StandardFonts.HelveticaOblique);
  const ink = rgb(0.12, 0.16, 0.19);
  const muted = rgb(0.35, 0.4, 0.44);
  const teal = rgb(0.12, 0.43, 0.42);
  const red = rgb(0.68, 0.16, 0.16);

  page.drawText("VERADOC.PE - COMPROBANTE DE PAGO (DEMO)", {
    x: 48, y: 744, size: 11, font: bold, color: teal,
  });
  page.drawText("MUESTRA SIN VALIDEZ TRIBUTARIA - NO EMITIDA POR SUNAT", {
    x: 48, y: 718, size: 9, font: bold, color: red,
  });
  page.drawText("Comprobante simulado", {
    x: 48, y: 660, size: 21, font: bold, color: ink,
  });

  const lines: [string, string][] = [
    ["REFERENCIA DEMO", packet.packetCode],
    ["FECHA DE PAGO SIMULADA", packet.payment.paidAt ?? "No registrada"],
    ["CONCEPTO", "Servicio de gestion de arrendamiento (demostracion)"],
    ["MONTO DE MUESTRA", `${packet.payment.currency} ${packet.payment.amount.toFixed(2)}`],
    ["INMUEBLE", `${packet.property.address}, ${packet.property.district}`],
    ["ESTADO", "Pago simulado confirmado"],
  ];

  let y = 606;
  for (const [label, value] of lines) {
    page.drawText(label, { x: 48, y, size: 8, font: bold, color: teal });
    y -= 17;
    page.drawText(pdfText(value), { x: 48, y, size: 11, font: regular, color: ink });
    y -= 36;
  }

  page.drawText("Este archivo es una ilustracion del dashboard demo.", {
    x: 48, y: 112, size: 10, font: italic, color: muted,
  });
  page.drawText("No es una factura, boleta ni comprobante fiscal valido.", {
    x: 48, y: 94, size: 10, font: italic, color: muted,
  });
  page.drawText("DEMO - SIN VALIDEZ TRIBUTARIA", {
    x: 94, y: 370, size: 27, font: bold, color: red,
    rotate: degrees(28), opacity: 0.24,
  });

  return document.save();
}

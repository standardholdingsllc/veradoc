import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import type { LeasePacket } from "@/lib/domain/types";

function pdfText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, " ")
    .slice(0, 120);
}

function drawWatermark(
  page: ReturnType<PDFDocument["addPage"]>,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
) {
  page.drawText("DEMO - NO ES UN CONTRATO VALIDO", {
    x: 74,
    y: 365,
    size: 28,
    font,
    color: rgb(0.75, 0.2, 0.2),
    rotate: degrees(28),
    opacity: 0.24,
  });
}

export async function createDemoPrintDocument(packet: LeasePacket): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  document.setTitle(`Muestra de impresion demo ${packet.packetCode}`);
  document.setSubject("Documento de demostracion sin validez legal");
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const italic = await document.embedFont(StandardFonts.HelveticaOblique);
  const pageSize: [number, number] = [612, 792];
  const ink = rgb(0.12, 0.16, 0.19);
  const muted = rgb(0.35, 0.4, 0.44);
  const teal = rgb(0.12, 0.43, 0.42);

  const first = document.addPage(pageSize);
  first.drawText("VERADOC.PE - MUESTRA PARA IMPRESION", {
    x: 48, y: 744, size: 10, font: bold, color: teal,
  });
  first.drawText("NO ES EL CONTRATO ORIGINAL NI TIENE VALIDEZ LEGAL", {
    x: 48, y: 724, size: 9, font: bold, color: rgb(0.68, 0.16, 0.16),
  });
  first.drawText("Resumen del expediente de arrendamiento", {
    x: 48, y: 674, size: 19, font: bold, color: ink,
  });
  first.drawText(pdfText(packet.packetCode), {
    x: 48, y: 649, size: 12, font: regular, color: muted,
  });

  const lines = [
    ["INMUEBLE", `${packet.property.address}, ${packet.property.district}`],
    ["ARRENDADORES", packet.signers.filter((s) => s.roleInLease === "landlord").map((s) => s.fullName).join(", ") || "No registrado"],
    ["ARRENDATARIOS", packet.signers.filter((s) => s.roleInLease === "renter").map((s) => s.fullName).join(", ") || "No registrado"],
    ["RENTA MENSUAL", `S/ ${packet.leaseTerms.monthlyRent.toFixed(2)}`],
    ["INICIO", packet.leaseTerms.startDate],
    ["VENCIMIENTO", packet.leaseTerms.expirationDate],
    ["ARCHIVO DE REFERENCIA", packet.leaseDocument.fileName],
    ["ESTADO", "Firmas completadas - certificacion simulada pendiente"],
  ];

  let y = 602;
  for (const [label, value] of lines) {
    first.drawText(label, { x: 48, y, size: 8, font: bold, color: teal });
    y -= 17;
    first.drawText(pdfText(value), { x: 48, y, size: 11, font: regular, color: ink });
    y -= 31;
  }
  first.drawText("Las firmas digitales de este expediente y este PDF son simuladas.", {
    x: 48, y: 78, size: 9, font: italic, color: muted,
  });
  drawWatermark(first, italic);

  const second = document.addPage(pageSize);
  second.drawText("ANEXO DE DEMOSTRACION NOTARIAL", {
    x: 48, y: 744, size: 10, font: bold, color: teal,
  });
  second.drawText(pdfText(packet.packetCode), {
    x: 48, y: 704, size: 17, font: bold, color: ink,
  });
  second.drawText("Espacio ilustrativo para sello y firma notarial", {
    x: 48, y: 674, size: 11, font: regular, color: muted,
  });
  second.drawRectangle({
    x: 72, y: 390, width: 468, height: 210,
    borderColor: rgb(0.72, 0.75, 0.74), borderWidth: 1,
  });
  second.drawText("AREA DE MUESTRA - NO APLICAR COMO CERTIFICACION REAL", {
    x: 116, y: 490, size: 11, font: bold, color: rgb(0.68, 0.16, 0.16),
  });
  second.drawText("Este anexo solo ilustra el flujo de la demostracion.", {
    x: 48, y: 342, size: 10, font: italic, color: muted,
  });
  second.drawText("No contiene un acto notarial ni sustituye el documento fuente.", {
    x: 48, y: 324, size: 10, font: italic, color: muted,
  });
  drawWatermark(second, italic);

  return document.save();
}

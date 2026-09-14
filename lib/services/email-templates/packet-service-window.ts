import {
  emailButton,
  emailHeading,
  emailInfoBox,
  emailLayout,
  emailParagraph,
  emailTable,
} from "./layout";

interface ServiceWindowEmailParams {
  recipientName: string;
  packetCode: string;
  propertyAddress: string;
  dashboardUrl: string;
}

export function packetServiceWindowReminderHtml(
  params: ServiceWindowEmailParams & { daysRemaining: number; endsAt: string },
): string {
  return emailLayout(
    `${emailHeading("Tu ventana de servicio está por vencer")}
    ${emailParagraph(`Hola <strong>${params.recipientName}</strong>,`) }
    ${emailParagraph(`Quedan <strong>${params.daysRemaining} días</strong> para completar este paquete dentro de su ventana de servicio VeraDoc.`)}
    ${emailTable([
      ["Paquete", params.packetCode],
      ["Inmueble", params.propertyAddress],
      ["Vence", params.endsAt],
    ])}
    ${emailInfoBox("El vencimiento no genera reembolso, crédito ni saldo a favor. Completa las acciones pendientes antes de la fecha indicada.", "warning")}
    ${emailButton(params.dashboardUrl, "Continuar paquete")}`,
    { preheader: `Quedan ${params.daysRemaining} días para completar tu paquete VeraDoc.` },
  );
}

export function packetArchivedHtml(params: ServiceWindowEmailParams): string {
  return emailLayout(
    `${emailHeading("Paquete archivado")}
    ${emailParagraph(`Hola <strong>${params.recipientName}</strong>,`) }
    ${emailParagraph("La ventana de servicio de 90 días venció sin completarse y el paquete fue archivado.")}
    ${emailTable([
      ["Paquete", params.packetCode],
      ["Inmueble", params.propertyAddress],
      ["Motivo", "Inactividad al finalizar la ventana de servicio"],
    ])}
    ${emailInfoBox("El archivo es un cierre operativo: no crea un reembolso, crédito ni saldo a favor. El expediente y su trazabilidad se conservan conforme a la política de almacenamiento.")}
    ${emailButton(params.dashboardUrl, "Ver paquete")}`,
    { preheader: "Tu paquete VeraDoc fue archivado al concluir su ventana de servicio." },
  );
}


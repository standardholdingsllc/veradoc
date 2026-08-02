import { emailLayout, emailHeading, emailParagraph, emailButton, emailTable } from "./layout";

export function packetCertifiedHtml(params: {
  recipientName: string;
  packetCode: string;
  propertyAddress: string;
  dashboardUrl: string;
}): string {
  return emailLayout(`
    ${emailHeading("Contrato certificado")}
    ${emailParagraph(`Hola <strong>${params.recipientName}</strong>,`)}
    ${emailParagraph("Tu contrato ha sido certificado por el notario y está disponible para descarga.")}
    ${emailTable([
      ["Código", params.packetCode],
      ["Propiedad", params.propertyAddress],
    ])}
    ${emailButton(params.dashboardUrl, "Descargar documento")}
  `, { preheader: `Contrato ${params.packetCode} certificado` });
}

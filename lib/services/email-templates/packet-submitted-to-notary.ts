import { emailLayout, emailHeading, emailParagraph, emailButton, emailTable } from "./layout";

export function packetSubmittedToNotaryHtml(params: {
  notaryName: string;
  packetCode: string;
  propertyAddress: string;
  realtorName: string;
  reviewUrl: string;
}): string {
  return emailLayout(`
    ${emailHeading("Nuevo paquete para revisión")}
    ${emailParagraph(`Hola <strong>${params.notaryName}</strong>,`)}
    ${emailParagraph(`<strong>${params.realtorName}</strong> envió un paquete para tu revisión y certificación.`)}
    ${emailTable([
      ["Código", params.packetCode],
      ["Propiedad", params.propertyAddress],
    ])}
    ${emailButton(params.reviewUrl, "Revisar paquete")}
  `, { preheader: `Nuevo paquete ${params.packetCode} pendiente de revisión` });
}

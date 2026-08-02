import { emailLayout, emailHeading, emailParagraph, emailButton } from "./layout";

export function signerCompletionHtml(params: {
  signerName: string;
  propertyAddress: string;
  dashboardUrl: string;
}): string {
  return emailLayout(`
    ${emailHeading("Firma completada")}
    ${emailParagraph(`Hola <strong>${params.signerName}</strong>,`)}
    ${emailParagraph(`Has completado tu firma para el contrato en <strong>${params.propertyAddress}</strong>. Te notificaremos cuando sea certificado.`)}
    ${emailButton(params.dashboardUrl, "Ver mi contrato")}
  `, { preheader: "Tu firma fue registrada exitosamente" });
}

import { emailLayout, emailHeading, emailParagraph, emailInfoBox } from "./layout";

export function realtorRejectedHtml(params: {
  realtorName: string;
  reason?: string;
}): string {
  const reasonBlock = params.reason
    ? emailInfoBox(`<strong>Motivo:</strong> ${params.reason}`, "error")
    : "";

  return emailLayout(`
    ${emailHeading("Solicitud no aprobada")}
    ${emailParagraph(`Hola <strong>${params.realtorName}</strong>,`)}
    ${emailParagraph("Tu solicitud de registro como agente inmobiliario no ha sido aprobada en esta oportunidad.")}
    ${reasonBlock}
  `, { preheader: "Resultado de tu solicitud de registro en VeraDoc" });
}

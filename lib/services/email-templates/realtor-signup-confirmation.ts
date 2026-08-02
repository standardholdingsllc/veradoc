import { emailLayout, emailHeading, emailParagraph, emailSmall } from "./layout";

export function realtorSignupConfirmationHtml(params: {
  realtorName: string;
}): string {
  return emailLayout(`
    ${emailHeading("Solicitud recibida")}
    ${emailParagraph(`Hola <strong>${params.realtorName}</strong>,`)}
    ${emailParagraph("Hemos recibido tu solicitud de registro como agente inmobiliario en VeraDoc. Te notificaremos cuando tu cuenta sea aprobada.")}
    ${emailSmall("El proceso toma entre 24 a 48 horas hábiles.")}
  `, { preheader: "Tu solicitud de registro en VeraDoc fue recibida" });
}

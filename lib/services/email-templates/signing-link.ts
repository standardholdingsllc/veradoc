import { emailLayout, emailHeading, emailParagraph, emailButton, emailSmall } from "./layout";

export function signingLinkEmailHtml(params: {
  signerName: string;
  realtorName: string;
  propertyAddress: string;
  signingUrl: string;
  expiresAt: string;
}): string {
  return emailLayout(`
    ${emailHeading("Invitación a firmar")}
    ${emailParagraph(`Hola <strong>${params.signerName}</strong>,`)}
    ${emailParagraph(`<strong>${params.realtorName}</strong> te invita a firmar un contrato de arrendamiento para:`)}
    ${emailParagraph(`<strong>${params.propertyAddress}</strong>`)}
    ${emailButton(params.signingUrl, "Comenzar firma")}
    ${emailSmall(`Enlace válido hasta el ${params.expiresAt}`)}
  `, { preheader: `${params.realtorName} te invita a firmar un contrato` });
}

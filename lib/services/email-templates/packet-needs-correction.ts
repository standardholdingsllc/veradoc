import { emailLayout, emailHeading, emailParagraph, emailButton, emailInfoBox, emailTable } from "./layout";

/**
 * Sent to the realtor when a notary returns a packet for correction.
 */
export function packetNeedsCorrectionHtml(params: {
  realtorName: string;
  packetCode: string;
  propertyAddress: string;
  reason: string;
  packetUrl: string;
}): string {
  return emailLayout(`
    ${emailHeading("Paquete devuelto")}
    ${emailParagraph(`Hola <strong>${params.realtorName}</strong>,`)}
    ${emailParagraph(`El notario devolvió el paquete <strong>${params.packetCode}</strong> para corrección.`)}
    ${emailInfoBox(params.reason, "warning")}
    ${emailTable([
      ["Propiedad", params.propertyAddress],
    ])}
    ${emailButton(params.packetUrl, "Corregir paquete")}
  `, { preheader: `Paquete ${params.packetCode} devuelto para corrección` });
}

/**
 * Sent to landlord/renter when a packet is returned for correction.
 */
export function packetNeedsCorrectionPartyHtml(params: {
  partyName: string;
  packetCode: string;
  propertyAddress: string;
  realtorName: string;
}): string {
  return emailLayout(`
    ${emailHeading("Contrato en revisión")}
    ${emailParagraph(`Hola <strong>${params.partyName}</strong>,`)}
    ${emailParagraph(`El contrato para <strong>${params.propertyAddress}</strong> requiere ajustes antes de ser certificado.`)}
    ${emailParagraph(`Tu agente inmobiliario <strong>${params.realtorName}</strong> se encargará de las correcciones. No necesitas hacer nada por ahora.`)}
  `, { preheader: `Contrato ${params.packetCode} — tu agente está realizando correcciones` });
}

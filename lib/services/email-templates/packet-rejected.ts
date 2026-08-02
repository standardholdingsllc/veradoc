import { emailLayout, emailHeading, emailParagraph, emailInfoBox, emailTable } from "./layout";

/**
 * Sent to the realtor when a packet is rejected by the notary.
 */
export function packetRejectedHtml(params: {
  realtorName: string;
  packetCode: string;
  propertyAddress: string;
  reason: string;
}): string {
  return emailLayout(`
    ${emailHeading("Paquete rechazado")}
    ${emailParagraph(`Hola <strong>${params.realtorName}</strong>,`)}
    ${emailParagraph(`El notario rechazó el paquete <strong>${params.packetCode}</strong>.`)}
    ${emailInfoBox(params.reason, "error")}
    ${emailTable([
      ["Propiedad", params.propertyAddress],
    ])}
  `, { preheader: `Paquete ${params.packetCode} rechazado` });
}

/**
 * Sent to landlord/renter when a packet is rejected — directs them to their agent.
 */
export function packetRejectedPartyHtml(params: {
  partyName: string;
  packetCode: string;
  propertyAddress: string;
  realtorName: string;
}): string {
  return emailLayout(`
    ${emailHeading("Contrato no aprobado")}
    ${emailParagraph(`Hola <strong>${params.partyName}</strong>,`)}
    ${emailParagraph(`El contrato para <strong>${params.propertyAddress}</strong> no ha sido aprobado por el notario.`)}
    ${emailParagraph(`Para más información, comunícate con tu agente inmobiliario: <strong>${params.realtorName}</strong>.`)}
  `, { preheader: `Contrato ${params.packetCode} — comunícate con tu agente` });
}

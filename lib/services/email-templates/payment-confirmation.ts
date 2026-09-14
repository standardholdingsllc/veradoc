import { emailLayout, emailHeading, emailParagraph, emailTable } from "./layout";

export function paymentConfirmationHtml(params: {
  realtorName: string;
  packetCode: string;
  amount: string;
  providerPaymentId: string;
  propertyAddress: string;
}): string {
  return emailLayout(`
    ${emailHeading("Pago confirmado")}
    ${emailParagraph(`Hola <strong>${params.realtorName}</strong>,`)}
    ${emailParagraph("Tu pago fue procesado exitosamente.")}
    ${emailTable([
      ["Paquete", params.packetCode],
      ["Propiedad", params.propertyAddress],
      ["Monto", `S/ ${params.amount}`],
      ["Referencia", params.providerPaymentId],
    ])}
  `, { preheader: `Pago confirmado — S/ ${params.amount}` });
}

import { emailLayout, emailHeading, emailParagraph, emailInfoBox, emailTable, emailButton } from "./layout";

export function signerRejectedFirmEasyHtml(params: {
  realtorName: string;
  signerName: string;
  packetCode: string;
  propertyAddress: string;
  dashboardUrl: string;
}): string {
  return emailLayout(`
    ${emailHeading("Firmante rechazó firmar")}
    ${emailParagraph(`Hola <strong>${params.realtorName}</strong>,`)}
    ${emailInfoBox(
      `<strong>${params.signerName}</strong> ha rechazado firmar el contrato.`,
      "warning",
    )}
    ${emailTable([
      ["Paquete", params.packetCode],
      ["Propiedad", params.propertyAddress],
    ])}
    ${emailParagraph("Revisa el estado del paquete en tu panel para decidir los siguientes pasos.")}
    ${emailButton(params.dashboardUrl, "Ver paquete")}
  `, { preheader: `${params.signerName} rechazó firmar — ${params.packetCode}` });
}

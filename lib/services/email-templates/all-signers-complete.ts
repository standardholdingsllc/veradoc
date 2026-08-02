import { emailLayout, emailHeading, emailParagraph, emailButton, emailTable } from "./layout";

export function allSignersCompleteHtml(params: {
  realtorName: string;
  packetCode: string;
  propertyAddress: string;
  packetUrl: string;
}): string {
  return emailLayout(`
    ${emailHeading("Todos firmaron")}
    ${emailParagraph(`Hola <strong>${params.realtorName}</strong>,`)}
    ${emailParagraph("Todos los firmantes completaron. El paquete está listo para enviar al notario.")}
    ${emailTable([
      ["Código", params.packetCode],
      ["Propiedad", params.propertyAddress],
    ])}
    ${emailButton(params.packetUrl, "Ver paquete")}
  `, { preheader: `Paquete ${params.packetCode} — todos los firmantes completaron` });
}

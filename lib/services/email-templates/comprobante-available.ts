import { emailLayout, emailHeading, emailParagraph, emailTable } from "./layout";

function tipoDocLabel(tipoDoc: string): string {
  switch (tipoDoc) {
    case "01":
      return "Factura";
    case "03":
      return "Boleta de venta";
    case "07":
      return "Nota de crédito";
    default:
      return "Comprobante";
  }
}

export function comprobanteAvailableHtml(params: {
  recipientName: string;
  tipoDoc: string;
  documentNumber: string;
  packetCode: string;
  propertyAddress: string;
  dashboardUrl: string;
}): string {
  const label = tipoDocLabel(params.tipoDoc);

  return emailLayout(
    `
    ${emailHeading(`${label} disponible`)}
    ${emailParagraph(`Hola <strong>${params.recipientName}</strong>,`)}
    ${emailParagraph(`Tu ${label.toLowerCase()} electrónica ha sido aceptada por SUNAT y está lista para descargar.`)}
    ${emailTable([
      ["Tipo", label],
      ["Número", params.documentNumber],
      ["Paquete", params.packetCode],
      ["Propiedad", params.propertyAddress],
    ])}
    ${emailParagraph(`
      <a href="${params.dashboardUrl}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">
        Descargar ${label.toLowerCase()}
      </a>
    `)}
    ${emailParagraph(`El documento estará disponible en tu panel por al menos un año.`)}
  `,
    { preheader: `${label} ${params.documentNumber} lista para descarga` },
  );
}

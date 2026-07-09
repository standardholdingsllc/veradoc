import {
  emailLayout,
  emailHeading,
  emailParagraph,
  emailTable,
  emailDivider,
  emailSmall,
  emailInfoBox,
} from "./layout";

export function complaintConfirmationHtml(params: {
  consumerName: string;
  complaintCode: string;
  complaintType: "reclamo" | "queja";
  productOrService: string;
  description: string;
  requestedRemedy: string;
  submittedAt: string;
}): string {
  const typeLabel =
    params.complaintType === "reclamo" ? "Reclamo" : "Queja";

  return emailLayout(
    `
    ${emailHeading("Constancia de Recepción — Libro de Reclamaciones")}
    ${emailParagraph(`Estimado/a <strong>${params.consumerName}</strong>,`)}
    ${emailParagraph(`Le confirmamos que su ${typeLabel.toLowerCase()} ha sido registrado exitosamente en el Libro de Reclamaciones Virtual de VERADOC S.A.C.S.`)}
    ${emailTable([
      ["Código de seguimiento", params.complaintCode],
      ["Tipo", typeLabel],
      ["Fecha de registro", params.submittedAt],
      ["Producto/Servicio", params.productOrService],
    ])}
    ${emailDivider()}
    ${emailParagraph(`<strong>Descripción:</strong>`)}
    ${emailInfoBox(params.description)}
    ${emailParagraph(`<strong>Solución solicitada:</strong>`)}
    ${emailInfoBox(params.requestedRemedy)}
    ${emailDivider()}
    ${emailParagraph(`De acuerdo con la Ley N° 29571 y el Decreto Supremo N° 011-2011-PCM, VERADOC S.A.C.S. atenderá su ${typeLabel.toLowerCase()} en un plazo máximo de <strong>15 días hábiles</strong> contados a partir de la fecha de registro.`)}
    ${emailSmall("Guarde este correo como constancia de su reclamo. Si tiene consultas adicionales, puede comunicarse a contacto@veradoc.pe")}
    ${emailSmall(`Código: ${params.complaintCode}`)}
  `,
    {
      preheader: `Su ${typeLabel.toLowerCase()} ${params.complaintCode} fue registrado exitosamente`,
    },
  );
}

import { emailLayout, emailHeading, emailParagraph, emailButton } from "./layout";

export function realtorApprovedHtml(params: {
  realtorName: string;
  loginUrl: string;
}): string {
  return emailLayout(`
    ${emailHeading("¡Cuenta aprobada!")}
    ${emailParagraph(`Hola <strong>${params.realtorName}</strong>,`)}
    ${emailParagraph("Tu cuenta ha sido aprobada. Ya puedes iniciar sesión y crear paquetes de arrendamiento con certificación notarial.")}
    ${emailButton(params.loginUrl, "Iniciar sesión")}
  `, { preheader: "Tu cuenta de agente en VeraDoc ha sido aprobada" });
}

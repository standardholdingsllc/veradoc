export function getDemoEmailErrorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : "";

  switch (code) {
    case "DEMO_EMAIL_NOT_CONFIGURED":
      return "El paquete quedó listo para firmas, pero el correo demo no está configurado.";
    case "DEMO_EMAIL_NOT_ALLOWED":
      return "El correo del firmante no está habilitado para envíos demo.";
    case "DEMO_EMAIL_RATE_LIMITED":
      return "Se alcanzó el límite de envíos demo. Espere 15 minutos antes de reintentar.";
    case "DEMO_EMAIL_PROVIDER_REJECTED":
    case "DEMO_EMAIL_PROVIDER_FAILED":
      return "El paquete quedó listo para firmas, pero el correo no salió. Puede reintentar con «Enviar recordatorio».";
    case "DEMO_SIGNING_LINKS_NOT_PERSISTED":
      return "No se pudo guardar el estado de envío. Actualice el paquete antes de volver a intentar.";
    case "DEMO_PRESENTER_REQUIRED":
      return "La sesión demo venció. Vuelva a abrir el enlace de acceso del agente y reintente.";
    default:
      return "No se pudieron enviar los correos demo. El paquete quedó guardado; puede reintentar con «Enviar recordatorio».";
  }
}

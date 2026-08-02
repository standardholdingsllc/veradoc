/**
 * Versioned consent text for the signing flow.
 * TODO Section 21: Replace with approved legal copy (Ley 29733 compliance).
 *
 * This file must remain client-safe (no Node.js crypto).
 * The version hash is pre-computed and hardcoded.
 */
export const CONSENT_TEXT = `
CONSENTIMIENTO PARA TRATAMIENTO DE DATOS PERSONALES Y PRESENTACIÓN NOTARIAL

Al aceptar este consentimiento, usted autoriza lo siguiente:

1. DATOS RECOPILADOS
   Se recopilarán los siguientes datos personales: nombre completo, DNI, correo electrónico, número de WhatsApp, fotografía del DNI (anverso y reverso), fotografía de autoidentificación (selfie), dirección IP y agente de navegador.

2. FINALIDAD
   Sus datos serán utilizados exclusivamente para:
   - Verificar su identidad como parte del contrato de arrendamiento
   - Generar el expediente de evidencia para presentación ante notario público
   - Registrar la firma digital del contrato conforme a la normativa IOFE

3. DESTINATARIOS
   Sus datos serán compartidos con:
   - El notario público asignado para la revisión y certificación del contrato
   - El agente inmobiliario que gestiona el paquete de arrendamiento
   - Las demás partes firmantes del contrato

4. ALMACENAMIENTO Y RETENCIÓN
   Sus datos serán almacenados de forma segura en servidores con cifrado en reposo. El período de retención será conforme a lo establecido por la normativa peruana aplicable.

5. DERECHOS DEL TITULAR
   Conforme a la Ley N° 29733, Ley de Protección de Datos Personales, usted tiene derecho a:
   - Acceder a sus datos personales
   - Rectificar datos inexactos
   - Cancelar el tratamiento de sus datos
   - Oponerse al tratamiento de sus datos
   Para ejercer estos derechos, comuníquese a través de los canales indicados en nuestra Política de Privacidad.

6. BASE LEGAL
   El tratamiento se realiza con base en su consentimiento expreso y en la ejecución del contrato de arrendamiento del cual es parte.

Al marcar la casilla de aceptación, usted declara haber leído y comprendido este consentimiento, y acepta el tratamiento de sus datos personales conforme a lo descrito.
`.trim();

// Pre-computed SHA-256 of CONSENT_TEXT (first 16 hex chars).
// Regenerate when CONSENT_TEXT changes:
//   node -e "const c=require('crypto');console.log(c.createHash('sha256').update(CONSENT_TEXT).digest('hex').slice(0,16))"
export const CONSENT_VERSION = "v1-placeholder";

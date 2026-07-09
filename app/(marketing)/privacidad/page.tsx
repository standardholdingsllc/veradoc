import type { Metadata } from "next";
import { META } from "@/lib/i18n/labels";

export const metadata: Metadata = {
  title: `Política de Privacidad — ${META.siteName}`,
  description:
    "Política de privacidad de VeraDoc conforme a la Ley N° 29733 de Protección de Datos Personales del Perú.",
};

const LAST_UPDATED = "9 de julio de 2026";

export default function PrivacidadPage() {
  return (
    <article className="mx-auto w-full max-w-[800px] px-4 py-12">
      <header className="mb-10">
        <h1 className="text-3xl font-semibold text-primary">
          Política de Privacidad
        </h1>
        <p className="mt-2 text-sm text-muted">
          Última actualización: {LAST_UPDATED}
        </p>
      </header>

      <div className="prose-legal space-y-8 text-base leading-relaxed text-foreground">
        <section>
          <h2 className="mb-3 text-xl font-semibold text-primary">
            1. Identidad del Responsable del Tratamiento
          </h2>
          <p>
            <strong>VERADOC S.A.C.S.</strong> (en adelante, &ldquo;VeraDoc&rdquo;), con
            RUC N° 20616178548, domiciliada en Lima, Perú, es responsable del
            tratamiento de los datos personales que usted nos proporcione a
            través de la plataforma <strong>veradoc.pe</strong> y sus servicios
            asociados.
          </p>
          <p className="mt-2">
            Correo de contacto para asuntos de datos personales:{" "}
            <a
              href="mailto:privacidad@veradoc.pe"
              className="text-secondary underline"
            >
              privacidad@veradoc.pe
            </a>
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-primary">
            2. Marco Legal Aplicable
          </h2>
          <p>
            La presente política se rige por la Ley N° 29733, Ley de Protección
            de Datos Personales del Perú, su Reglamento aprobado por Decreto
            Supremo N° 003-2013-JUS (modificado por D.S. N° 016-2024-JUS), y
            las directrices emitidas por la Autoridad Nacional de Protección de
            Datos Personales (ANPDP).
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-primary">
            3. Datos Personales que Recopilamos
          </h2>
          <p>Según el tipo de usuario y servicio, recopilamos:</p>
          <ul className="mt-3 list-disc space-y-1 pl-6">
            <li>
              <strong>Datos de identificación:</strong> nombre completo, número
              de DNI o documento de identidad, fotografía del DNI (anverso y
              reverso), fotografía de autoidentificación (selfie).
            </li>
            <li>
              <strong>Datos de contacto:</strong> correo electrónico, número de
              teléfono/WhatsApp.
            </li>
            <li>
              <strong>Datos profesionales (agentes inmobiliarios):</strong> razón
              social, RUC, número de licencia inmobiliaria, nombre de la
              empresa.
            </li>
            <li>
              <strong>Datos de uso de la plataforma:</strong> dirección IP,
              agente de navegador, fecha y hora de acceso, historial de acciones
              en la plataforma.
            </li>
            <li>
              <strong>Datos de transacciones:</strong> información de pagos
              procesados a través de nuestra pasarela de pagos (los datos de
              tarjeta son gestionados exclusivamente por el procesador de pagos
              autorizado y nunca almacenados en nuestros servidores).
            </li>
            <li>
              <strong>Datos generados durante el servicio:</strong> firma
              digital, código OTP de verificación, hash criptográfico de
              documentos, registros de auditoría.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-primary">
            4. Finalidad del Tratamiento
          </h2>
          <p>Sus datos personales son tratados para las siguientes finalidades:</p>
          <ul className="mt-3 list-disc space-y-1 pl-6">
            <li>
              Verificar su identidad como parte de un contrato de arrendamiento.
            </li>
            <li>
              Generar el paquete de evidencia notarial para presentación ante
              notario público.
            </li>
            <li>
              Registrar la firma digital del contrato conforme a la normativa
              IOFE.
            </li>
            <li>
              Gestionar la relación contractual con agentes inmobiliarios,
              arrendadores y arrendatarios.
            </li>
            <li>Procesar pagos y emitir comprobantes de pago.</li>
            <li>
              Cumplir obligaciones legales, contables, tributarias y regulatorias.
            </li>
            <li>
              Enviar notificaciones relacionadas con el estado de los paquetes
              de arrendamiento (correo electrónico y WhatsApp).
            </li>
            <li>Mejorar la calidad y seguridad de nuestros servicios.</li>
            <li>
              Atender solicitudes, consultas y reclamos a través de nuestro
              Libro de Reclamaciones.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-primary">
            5. Base Legal del Tratamiento
          </h2>
          <p>El tratamiento de sus datos personales se fundamenta en:</p>
          <ul className="mt-3 list-disc space-y-1 pl-6">
            <li>
              <strong>Consentimiento expreso:</strong> obtenido mediante casilla
              de verificación no premarcada al momento de registrarse o utilizar
              nuestros servicios.
            </li>
            <li>
              <strong>Ejecución contractual:</strong> necesario para la
              prestación del servicio de certificación de arrendamiento.
            </li>
            <li>
              <strong>Cumplimiento de obligaciones legales:</strong> Ley 29733,
              Código de Protección y Defensa del Consumidor, normativa
              tributaria y notarial aplicable.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-primary">
            6. Destinatarios y Transferencia de Datos
          </h2>
          <p>Sus datos pueden ser compartidos con:</p>
          <ul className="mt-3 list-disc space-y-1 pl-6">
            <li>
              El notario público asignado para la revisión y certificación del
              contrato.
            </li>
            <li>
              El agente inmobiliario que gestiona el paquete de arrendamiento.
            </li>
            <li>Las demás partes firmantes del contrato.</li>
            <li>
              Procesadores de pago autorizados (quienes cuentan con sus propias
              políticas de protección de datos).
            </li>
            <li>
              Proveedores de servicios tecnológicos (hosting, correo
              electrónico, almacenamiento en la nube) que actúan como
              encargados de tratamiento bajo contrato de confidencialidad.
            </li>
            <li>
              Autoridades públicas cuando sea requerido por ley o resolución
              judicial.
            </li>
          </ul>
          <p className="mt-3">
            No vendemos, alquilamos ni cedemos sus datos personales a terceros
            con fines comerciales o publicitarios.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-primary">
            7. Almacenamiento y Seguridad
          </h2>
          <p>
            Sus datos personales son almacenados en servidores seguros con
            cifrado en reposo y en tránsito (TLS/SSL). Implementamos medidas
            técnicas y organizativas adecuadas para proteger sus datos contra
            acceso no autorizado, pérdida, alteración o destrucción, incluyendo:
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-6">
            <li>Cifrado de datos en reposo y en tránsito.</li>
            <li>Control de acceso basado en roles (RLS).</li>
            <li>Registros de auditoría de todas las operaciones sensibles.</li>
            <li>
              Verificación de integridad documental mediante hash criptográfico
              SHA-256.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-primary">
            8. Plazo de Conservación
          </h2>
          <p>
            Los datos personales serán conservados durante el tiempo necesario
            para cumplir con las finalidades descritas y, como mínimo, durante
            los plazos establecidos por la normativa peruana aplicable:
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-6">
            <li>
              Datos de contratos certificados: conforme a los plazos de
              conservación notarial y tributaria vigentes.
            </li>
            <li>Datos de reclamos: mínimo 2 años (DS 011-2011-PCM).</li>
            <li>
              Datos de facturación: conforme a la normativa tributaria de SUNAT.
            </li>
          </ul>
          <p className="mt-3">
            Transcurridos los plazos legales, los datos serán eliminados o
            anonimizados.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-primary">
            9. Derechos del Titular (Derechos ARCO)
          </h2>
          <p>
            Conforme a la Ley N° 29733, usted tiene derecho a:
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-6">
            <li>
              <strong>Acceso:</strong> conocer qué datos personales suyos
              están siendo tratados.
            </li>
            <li>
              <strong>Rectificación:</strong> solicitar la corrección de datos
              inexactos o incompletos.
            </li>
            <li>
              <strong>Cancelación:</strong> solicitar la supresión de sus datos
              cuando ya no sean necesarios para la finalidad para la que fueron
              recopilados.
            </li>
            <li>
              <strong>Oposición:</strong> oponerse al tratamiento de sus datos
              en determinadas circunstancias.
            </li>
          </ul>
          <p className="mt-3">
            Para ejercer estos derechos, envíe su solicitud a{" "}
            <a
              href="mailto:privacidad@veradoc.pe"
              className="text-secondary underline"
            >
              privacidad@veradoc.pe
            </a>{" "}
            adjuntando copia de su documento de identidad. Responderemos en un
            plazo máximo de 10 días hábiles conforme a ley.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-primary">
            10. Uso de Cookies y Tecnologías Similares
          </h2>
          <p>
            Nuestra plataforma utiliza cookies estrictamente necesarias para el
            funcionamiento del servicio, incluyendo cookies de sesión para la
            autenticación de usuarios. No utilizamos cookies de seguimiento o
            publicidad de terceros.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-primary">
            11. Datos de Menores de Edad
          </h2>
          <p>
            Nuestros servicios están dirigidos exclusivamente a personas mayores
            de 18 años. No recopilamos conscientemente datos personales de
            menores de edad. Si tomamos conocimiento de que hemos recopilado
            datos de un menor sin el consentimiento correspondiente,
            procederemos a eliminarlos de inmediato.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-primary">
            12. Modificaciones a esta Política
          </h2>
          <p>
            VeraDoc se reserva el derecho de actualizar esta política para
            reflejar cambios en nuestras prácticas o en la normativa aplicable.
            Cualquier modificación será publicada en esta página con la fecha
            de actualización correspondiente. Recomendamos revisarla
            periódicamente.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-primary">
            13. Autoridad Competente
          </h2>
          <p>
            Si considera que el tratamiento de sus datos personales infringe la
            normativa vigente, tiene derecho a presentar una reclamación ante la
            Autoridad Nacional de Protección de Datos Personales (ANPDP) del
            Ministerio de Justicia y Derechos Humanos del Perú.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-primary">
            14. Contacto
          </h2>
          <p>
            Para cualquier consulta relacionada con esta política o con el
            tratamiento de sus datos personales, puede contactarnos a:
          </p>
          <ul className="mt-3 list-none space-y-1 pl-0">
            <li>
              <strong>Empresa:</strong> VERADOC S.A.C.S.
            </li>
            <li>
              <strong>RUC:</strong> 20616178548
            </li>
            <li>
              <strong>Correo:</strong>{" "}
              <a
                href="mailto:privacidad@veradoc.pe"
                className="text-secondary underline"
              >
                privacidad@veradoc.pe
              </a>
            </li>
            <li>
              <strong>Sitio web:</strong>{" "}
              <a
                href="https://veradoc.pe"
                className="text-secondary underline"
              >
                veradoc.pe
              </a>
            </li>
          </ul>
        </section>
      </div>
    </article>
  );
}

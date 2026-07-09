import type { Metadata } from "next";
import { META } from "@/lib/i18n/labels";

export const metadata: Metadata = {
  title: `Términos y Condiciones — ${META.siteName}`,
  description:
    "Términos y condiciones de uso de la plataforma VeraDoc para certificación de arrendamientos en Perú.",
};

const LAST_UPDATED = "9 de julio de 2026";

export default function TerminosPage() {
  return (
    <article className="mx-auto w-full max-w-[800px] px-4 py-12">
      <header className="mb-10">
        <h1 className="text-3xl font-semibold text-primary">
          Términos y Condiciones
        </h1>
        <p className="mt-2 text-sm text-muted">
          Última actualización: {LAST_UPDATED}
        </p>
      </header>

      <div className="space-y-8 text-base leading-relaxed text-foreground">
        <section>
          <h2 className="mb-3 text-xl font-semibold text-primary">
            1. Información General
          </h2>
          <p>
            Los presentes Términos y Condiciones (en adelante, los
            &ldquo;Términos&rdquo;) regulan el acceso y uso de la plataforma
            digital <strong>veradoc.pe</strong> (en adelante, la
            &ldquo;Plataforma&rdquo;), operada por{" "}
            <strong>VERADOC S.A.C.S.</strong>, con RUC N° 20616178548,
            domiciliada en Lima, Perú (en adelante, &ldquo;VeraDoc&rdquo;).
          </p>
          <p className="mt-3">
            Al acceder, registrarse o utilizar cualquier servicio de la
            Plataforma, usted declara haber leído, comprendido y aceptado estos
            Términos en su totalidad. Si no está de acuerdo con alguna
            disposición, le solicitamos abstenerse de utilizar la Plataforma.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-primary">
            2. Descripción del Servicio
          </h2>
          <p>
            VeraDoc es una plataforma tecnológica que facilita la{" "}
            <strong>
              certificación remota de contratos de arrendamiento con revisión
              notarial
            </strong>{" "}
            en el mercado inmobiliario peruano. El servicio comprende:
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-6">
            <li>
              Creación de paquetes de evidencia notarial estructurados por
              agentes inmobiliarios.
            </li>
            <li>
              Flujo de firma digital remota para arrendadores y arrendatarios,
              incluyendo verificación de identidad (DNI y selfie), OTP por
              WhatsApp, consentimiento de datos y firma digital conforme a IOFE.
            </li>
            <li>
              Generación de informes de evidencia para revisión y certificación
              por notario público contratado.
            </li>
            <li>
              Registro post-certificación del contrato para acceso de las
              partes.
            </li>
          </ul>
          <p className="mt-3">
            <strong>VeraDoc es una plataforma de evidencia, no un
            notario.</strong> La autoridad de certificación recae
            exclusivamente en el notario público que revisa y certifica cada
            paquete. VeraDoc no emite certificaciones notariales ni actúa como
            fedatario público.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-primary">
            3. Usuarios de la Plataforma
          </h2>
          <p>La Plataforma contempla los siguientes tipos de usuarios:</p>
          <ul className="mt-3 list-disc space-y-1 pl-6">
            <li>
              <strong>Agentes inmobiliarios:</strong> profesionales del sector
              inmobiliario que crean y gestionan paquetes de arrendamiento. Su
              registro requiere aprobación previa por parte de VeraDoc.
            </li>
            <li>
              <strong>Arrendadores y Arrendatarios:</strong> partes del contrato
              de arrendamiento que participan en el flujo de firma a través de
              enlaces seguros.
            </li>
            <li>
              <strong>Notarios:</strong> notarios públicos contratados por
              VeraDoc que revisan y certifican los paquetes de evidencia. Su
              incorporación es por invitación.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-primary">
            4. Registro y Cuenta de Usuario
          </h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              Para acceder a los servicios, los agentes inmobiliarios deben
              completar un proceso de registro proporcionando información veraz
              y completa, incluyendo razón social, RUC y número de licencia
              inmobiliaria.
            </li>
            <li>
              Usted es responsable de mantener la confidencialidad de sus
              credenciales de acceso y de todas las actividades realizadas bajo
              su cuenta.
            </li>
            <li>
              VeraDoc se reserva el derecho de rechazar, suspender o cancelar
              cuentas que proporcionen información falsa, incumplan estos
              Términos, o cuando existan indicios de uso fraudulento.
            </li>
            <li>
              Los arrendadores y arrendatarios acceden al flujo de firma
              mediante enlaces seguros con token, sin necesidad de registro
              previo.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-primary">
            5. Precios y Condiciones de Pago
          </h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              Los precios de los servicios se publican en la Plataforma en soles
              peruanos (PEN) e incluyen IGV cuando corresponda.
            </li>
            <li>
              El pago se realiza antes del envío del paquete de evidencia al
              notario, a través de los medios de pago habilitados en la
              Plataforma.
            </li>
            <li>
              Los pagos con tarjeta de crédito o débito son procesados por
              pasarelas de pago autorizadas y certificadas con estándares PCI
              DSS. VeraDoc no almacena datos de tarjeta en sus servidores.
            </li>
            <li>
              VeraDoc emitirá el comprobante de pago correspondiente conforme a
              la normativa tributaria peruana.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-primary">
            6. Proceso de Certificación
          </h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              Una vez que todas las partes firman y se completa el paquete de
              evidencia, este es remitido al notario asignado para su revisión.
            </li>
            <li>
              El notario puede certificar, solicitar correcciones o rechazar el
              paquete según su criterio profesional independiente.
            </li>
            <li>
              VeraDoc no garantiza la certificación de ningún paquete, ya que
              esta decisión corresponde exclusivamente al notario público.
            </li>
            <li>
              Los plazos de revisión dependen de la disponibilidad del notario
              asignado.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-primary">
            7. Obligaciones del Usuario
          </h2>
          <p>Al usar la Plataforma, usted se compromete a:</p>
          <ul className="mt-3 list-disc space-y-1 pl-6">
            <li>
              Proporcionar información veraz, exacta y completa.
            </li>
            <li>
              No suplantar la identidad de terceros ni proporcionar documentos
              falsificados.
            </li>
            <li>
              Utilizar la Plataforma únicamente para fines lícitos y conforme a
              la legislación peruana vigente.
            </li>
            <li>
              No intentar acceder de forma no autorizada a los sistemas de
              VeraDoc ni comprometer la seguridad de la Plataforma.
            </li>
            <li>
              Notificar de inmediato cualquier uso no autorizado de su cuenta.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-primary">
            8. Propiedad Intelectual
          </h2>
          <p>
            Todos los contenidos de la Plataforma — incluyendo diseño, código
            fuente, textos, logotipos, marcas y material gráfico — son
            propiedad de VERADOC S.A.C.S. o de sus licenciantes, y están
            protegidos por la legislación peruana e internacional sobre propiedad
            intelectual e industrial.
          </p>
          <p className="mt-3">
            Los documentos cargados por los usuarios (contratos de
            arrendamiento, documentos de identidad, fotografías) permanecen
            como propiedad de sus respectivos titulares. VeraDoc únicamente los
            procesa para la prestación del servicio contratado.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-primary">
            9. Limitación de Responsabilidad
          </h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              VeraDoc actúa como intermediario tecnológico y no es responsable
              por el contenido de los contratos de arrendamiento cargados por
              los usuarios.
            </li>
            <li>
              VeraDoc no otorga asesoría legal. Los usuarios deben obtener
              asesoramiento jurídico independiente respecto de sus contratos.
            </li>
            <li>
              VeraDoc no será responsable por interrupciones del servicio
              derivadas de causas de fuerza mayor, fallos de terceros
              proveedores de infraestructura, o mantenimiento programado.
            </li>
            <li>
              La responsabilidad de VeraDoc se limita al monto pagado por el
              servicio específico que originó el reclamo.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-primary">
            10. Protección de Datos Personales
          </h2>
          <p>
            El tratamiento de datos personales se rige por nuestra{" "}
            <a href="/privacidad" className="text-secondary underline">
              Política de Privacidad
            </a>
            , elaborada conforme a la Ley N° 29733, Ley de Protección de Datos
            Personales del Perú. Al utilizar la Plataforma, usted consiente el
            tratamiento de sus datos según lo descrito en dicha política.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-primary">
            11. Política de Devoluciones y Cancelaciones
          </h2>
          <p>
            Las condiciones de devolución y cancelación se detallan en nuestra{" "}
            <a href="/devoluciones" className="text-secondary underline">
              Política de Devoluciones y Cancelaciones
            </a>
            . Le recomendamos revisarla antes de contratar cualquier servicio.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-primary">
            12. Libro de Reclamaciones
          </h2>
          <p>
            En cumplimiento del Código de Protección y Defensa del Consumidor
            (Ley N° 29571) y el Decreto Supremo N° 011-2011-PCM, VeraDoc pone
            a disposición del consumidor un{" "}
            <a
              href="/libro-de-reclamaciones"
              className="text-secondary underline"
            >
              Libro de Reclamaciones Virtual
            </a>{" "}
            accesible desde la Plataforma.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-primary">
            13. Modificaciones
          </h2>
          <p>
            VeraDoc se reserva el derecho de modificar estos Términos en
            cualquier momento. Las modificaciones serán publicadas en esta
            página con la fecha de actualización correspondiente. El uso
            continuado de la Plataforma tras la publicación de cambios implica
            la aceptación de los Términos modificados.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-primary">
            14. Legislación Aplicable y Jurisdicción
          </h2>
          <p>
            Estos Términos se rigen por la legislación de la República del Perú.
            Cualquier controversia que no pueda resolverse amistosamente será
            sometida a la jurisdicción de los tribunales ordinarios de Lima,
            Perú, sin perjuicio de las competencias del INDECOPI conforme al
            Código de Protección y Defensa del Consumidor.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-primary">
            15. Contacto
          </h2>
          <p>
            Para consultas sobre estos Términos, puede contactarnos a:
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
                href="mailto:contacto@veradoc.pe"
                className="text-secondary underline"
              >
                contacto@veradoc.pe
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

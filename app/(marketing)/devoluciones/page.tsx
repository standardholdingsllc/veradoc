import type { Metadata } from "next";
import { META } from "@/lib/i18n/labels";

export const metadata: Metadata = {
  title: `Política de Devoluciones y Cancelaciones — ${META.siteName}`,
  description:
    "Política de devoluciones, cancelaciones y cambios de VeraDoc conforme a la Ley N° 29571, Código de Protección y Defensa del Consumidor del Perú.",
};

const LAST_UPDATED = "9 de julio de 2026";

export default function DevolucionesPage() {
  return (
    <article className="mx-auto w-full max-w-[800px] px-4 py-12">
      <header className="mb-10">
        <h1 className="text-3xl font-semibold text-primary">
          Política de Devoluciones y Cancelaciones
        </h1>
        <p className="mt-2 text-sm text-muted">
          Última actualización: {LAST_UPDATED}
        </p>
      </header>

      <div className="space-y-8 text-base leading-relaxed text-foreground">
        <section>
          <h2 className="mb-3 text-xl font-semibold text-primary">
            1. Alcance
          </h2>
          <p>
            La presente política regula las condiciones de devolución,
            cancelación y reembolso aplicables a los servicios ofrecidos por{" "}
            <strong>VERADOC S.A.C.S.</strong> (en adelante,
            &ldquo;VeraDoc&rdquo;) a través de la plataforma{" "}
            <strong>veradoc.pe</strong>, en cumplimiento del Código de
            Protección y Defensa del Consumidor (Ley N° 29571).
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-primary">
            2. Naturaleza del Servicio
          </h2>
          <p>
            VeraDoc ofrece un{" "}
            <strong>
              servicio digital de gestión documental y certificación notarial de
              contratos de arrendamiento
            </strong>
            . Dada la naturaleza del servicio:
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-6">
            <li>
              No se comercializan bienes físicos, por lo que no aplica una
              política de cambios o devolución de productos.
            </li>
            <li>
              El servicio se materializa mediante la generación de un paquete de
              evidencia notarial digital que, una vez procesado, no puede ser
              &ldquo;devuelto&rdquo; en sentido físico.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-primary">
            3. Cancelación Antes del Procesamiento
          </h2>
          <p>
            El agente inmobiliario que ha creado un paquete de arrendamiento
            puede solicitar su cancelación bajo las siguientes condiciones:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-6">
            <li>
              <strong>
                Antes del envío al notario y antes de que algún firmante haya
                completado el flujo de firma:
              </strong>{" "}
              se procederá al reembolso del 100% del monto pagado.
            </li>
            <li>
              <strong>
                Después de que al menos un firmante haya iniciado el flujo de
                firma, pero antes del envío al notario:
              </strong>{" "}
              se evaluará cada caso individualmente. Se podrá aplicar un
              reembolso parcial descontando los costos operativos ya incurridos.
            </li>
            <li>
              <strong>Después del envío al notario:</strong> no procede
              reembolso, dado que el servicio de revisión notarial ya ha sido
              iniciado.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-primary">
            4. Paquetes Rechazados por el Notario
          </h2>
          <p>
            Si un paquete de arrendamiento es rechazado por el notario durante
            su revisión:
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-6">
            <li>
              <strong>
                Si el rechazo se debe a deficiencias en la documentación
                proporcionada por el agente o los firmantes:
              </strong>{" "}
              no procede reembolso, ya que el servicio de revisión notarial fue
              efectivamente prestado.
            </li>
            <li>
              <strong>
                Si el rechazo se debe a un error atribuible a VeraDoc:
              </strong>{" "}
              se ofrecerá la reelaboración del paquete sin costo adicional o el
              reembolso completo del monto pagado, a elección del usuario.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-primary">
            5. Paquetes con Solicitud de Correcciones
          </h2>
          <p>
            Cuando el notario solicita correcciones al paquete, el agente podrá
            realizar los ajustes necesarios y reenviar el paquete sin costo
            adicional. Si el agente decide no continuar con el proceso luego de
            una solicitud de correcciones, no procede reembolso.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-primary">
            6. Fallos Técnicos de la Plataforma
          </h2>
          <p>
            Si la plataforma presenta una falla técnica que impida la
            finalización del servicio contratado, VeraDoc se compromete a:
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-6">
            <li>
              Resolver la falla y completar el servicio en el menor tiempo
              posible.
            </li>
            <li>
              En caso de que la falla no pueda ser resuelta en un plazo
              razonable, proceder al reembolso completo del monto pagado.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-primary">
            7. Procedimiento para Solicitar un Reembolso
          </h2>
          <p>Para solicitar un reembolso, el usuario deberá:</p>
          <ol className="mt-3 list-decimal space-y-2 pl-6">
            <li>
              Enviar su solicitud a{" "}
              <a
                href="mailto:contacto@veradoc.pe"
                className="text-secondary underline"
              >
                contacto@veradoc.pe
              </a>{" "}
              indicando: nombre completo, correo electrónico registrado, número
              del paquete de arrendamiento, motivo de la solicitud de reembolso
              y comprobante de pago.
            </li>
            <li>
              VeraDoc revisará la solicitud y comunicará su resolución en un
              plazo máximo de 10 días hábiles.
            </li>
            <li>
              De aprobarse el reembolso, este se realizará a través del mismo
              medio de pago utilizado en la transacción original en un plazo
              máximo de 15 días hábiles contados desde la aprobación.
            </li>
          </ol>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-primary">
            8. Derecho de Retracto
          </h2>
          <p>
            Conforme al artículo 59 de la Ley N° 29571, el consumidor puede
            ejercer su derecho de retracto dentro de los 7 días calendario
            posteriores a la contratación del servicio, siempre que el servicio
            no haya sido ejecutado en su totalidad o de forma sustancial. Para
            ejercer este derecho, comuníquese con nosotros a través de los
            canales indicados en la sección anterior.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-primary">
            9. Reclamaciones
          </h2>
          <p>
            Si no está conforme con la resolución de su solicitud de reembolso,
            puede presentar una reclamación a través de nuestro{" "}
            <a
              href="/libro-de-reclamaciones"
              className="text-secondary underline"
            >
              Libro de Reclamaciones Virtual
            </a>{" "}
            o acudir ante el INDECOPI.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-primary">
            10. Contacto
          </h2>
          <ul className="list-none space-y-1 pl-0">
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

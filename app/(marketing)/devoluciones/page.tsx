import type { Metadata } from "next";
import { META } from "@/lib/i18n/labels";

export const metadata: Metadata = {
  title: `Política de Devoluciones y Cancelaciones — ${META.siteName}`,
  description:
    "Política de devoluciones, cancelaciones y cambios de VeraDoc conforme a la Ley N° 29571, Código de Protección y Defensa del Consumidor del Perú.",
};

const LAST_UPDATED = "10 de septiembre de 2026";

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
            3. Regla General
          </h2>
          <p>
            El precio de VeraDoc corresponde al procesamiento digital de un
            documento y a la activación de su flujo de evidencia, firma,
            mensajería, comprobante y gestión notarial. Una vez confirmado el
            pago, <strong>no se ofrecen cancelaciones ni reembolsos de manera
            rutinaria</strong>, aun cuando el usuario no complete el flujo o el
            documento no alcance la certificación notarial.
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-6">
            <li>
              La decisión independiente del notario de observar, solicitar
              correcciones o rechazar un documento no convierte el pago en
              reembolsable.
            </li>
            <li>
              El abandono, la falta de respuesta de un firmante o el vencimiento
              de la ventana de servicio de 90 días no generan saldo, crédito ni
              reembolso automático.
            </li>
            <li>
              Los códigos promocionales privados reducen el precio de una
              transacción específica; no constituyen dinero electrónico, saldo
              a favor ni crédito transferible.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-primary">
            4. Excepciones Evaluables
          </h2>
          <p>
            VeraDoc podrá evaluar un reembolso excepcional cuando exista
            evidencia suficiente de uno de los siguientes supuestos:
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-6">
            <li>
              cobro duplicado, monto cobrado incorrectamente o pago no
              autorizado;
            </li>
            <li>
              falla sustancial atribuible a VeraDoc que impida prestar el
              servicio y que no pueda remediarse razonablemente; o
            </li>
            <li>un remedio exigido por la normativa aplicable o una autoridad competente.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-primary">
            5. Correcciones y Continuidad
          </h2>
          <p>
            Cuando el notario solicita correcciones comprendidas en el servicio,
            el agente puede ajustar y reenviar el paquete durante la ventana de
            servicio sin pagar nuevamente la tarifa estándar. Si decide no
            continuar, no procede un reembolso por ese solo hecho.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-primary">
            6. Trabajo Parcial y Costos ya Incurridos
          </h2>
          <p>
            Al evaluar una excepción, VeraDoc documentará el avance del paquete y
            los costos de proveedor, firma, mensajería, comprobante y notaría ya
            incurridos. Estos costos se conservan como evidencia contable de
            VeraDoc y de sus obligaciones frente a terceros; no crean un crédito
            para el usuario ni alteran los derechos que la ley le reconozca.
          </p>
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
            Esta política no limita los derechos irrenunciables ni los remedios
            que correspondan conforme a la normativa peruana aplicable. Para
            solicitar su evaluación, comuníquese por los canales indicados en la
            sección anterior.
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

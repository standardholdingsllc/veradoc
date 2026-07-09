"use client";

import { useState, useTransition, useRef } from "react";
import {
  submitComplaint,
  type ComplaintInput,
} from "@/lib/actions/complaints";
import { CheckCircle2, Printer } from "lucide-react";

const INITIAL: ComplaintInput = {
  consumerName: "",
  consumerDni: "",
  consumerEmail: "",
  consumerPhone: "",
  consumerAddress: "",
  consumerIsMinor: false,
  guardianName: "",
  guardianDni: "",
  complaintType: "reclamo",
  productOrService: "",
  orderNumber: "",
  amount: undefined as unknown as number,
  description: "",
  requestedRemedy: "",
  privacyConsent: false as unknown as true,
};

export function ComplaintForm() {
  const [form, setForm] = useState<ComplaintInput>(INITIAL);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [globalError, setGlobalError] = useState("");
  const [submittedCode, setSubmittedCode] = useState("");
  const [isPending, startTransition] = useTransition();
  const printRef = useRef<HTMLDivElement>(null);

  function set<K extends keyof ComplaintInput>(key: K, value: ComplaintInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGlobalError("");
    setFieldErrors({});

    startTransition(async () => {
      const result = await submitComplaint(form);
      if (result.success) {
        setSubmittedCode(result.code);
      } else {
        setGlobalError(result.error);
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
      }
    });
  }

  function handlePrint() {
    window.print();
  }

  if (submittedCode) {
    return (
      <div ref={printRef} className="mx-auto max-w-2xl space-y-6 py-8">
        <div className="rounded-lg border border-success/30 bg-success/5 p-8 text-center">
          <CheckCircle2 className="mx-auto mb-4 size-12 text-success" />
          <h2 className="text-2xl font-semibold text-primary">
            Reclamo Registrado Exitosamente
          </h2>
          <p className="mt-4 text-lg">
            Su código de reclamo es:
          </p>
          <p className="mt-2 font-mono text-3xl font-bold text-accent">
            {submittedCode}
          </p>
          <p className="mt-4 text-sm text-muted">
            Guarde este código para hacer seguimiento de su reclamo. También
            recibirá una copia en el correo electrónico proporcionado.
          </p>
          <p className="mt-2 text-sm text-muted">
            De acuerdo con la normativa vigente, VERADOC S.A.C.S. responderá a
            su reclamo en un plazo máximo de{" "}
            <strong>15 días hábiles</strong>.
          </p>
          <div className="mt-6 flex justify-center gap-4">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-surface"
            >
              <Printer className="size-4" />
              Imprimir constancia
            </button>
            <button
              onClick={() => {
                setSubmittedCode("");
                setForm(INITIAL);
              }}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
            >
              Registrar otro reclamo
            </button>
          </div>
        </div>

        {/* Print-only receipt */}
        <div className="hidden print:block print:p-8">
          <h1 className="text-xl font-bold">
            HOJA DE RECLAMACIÓN — LIBRO DE RECLAMACIONES VIRTUAL
          </h1>
          <p className="mt-2 text-sm">
            VERADOC S.A.C.S. · RUC 20616178548 · Lima, Perú
          </p>
          <hr className="my-4" />
          <p>
            <strong>Código:</strong> {submittedCode}
          </p>
          <p>
            <strong>Fecha:</strong>{" "}
            {new Date().toLocaleDateString("es-PE", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </p>
          <p>
            <strong>Consumidor:</strong> {form.consumerName}
          </p>
          <p>
            <strong>DNI:</strong> {form.consumerDni}
          </p>
          <p>
            <strong>Correo:</strong> {form.consumerEmail}
          </p>
          <p>
            <strong>Tipo:</strong>{" "}
            {form.complaintType === "reclamo" ? "Reclamo" : "Queja"}
          </p>
          <p>
            <strong>Producto/Servicio:</strong> {form.productOrService}
          </p>
          <p>
            <strong>Descripción:</strong> {form.description}
          </p>
          <p>
            <strong>Pedido del consumidor:</strong> {form.requestedRemedy}
          </p>
          <hr className="my-4" />
          <p className="text-xs text-gray-500">
            Plazo de respuesta: 15 días hábiles (Ley N° 29571, DS 011-2011-PCM)
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-8">
      {globalError && (
        <div className="rounded-md border border-error/30 bg-error/5 px-4 py-3 text-sm text-error">
          {globalError}
        </div>
      )}

      {/* Complaint type */}
      <fieldset className="space-y-3">
        <legend className="text-lg font-semibold text-primary">
          1. Tipo de Registro
        </legend>
        <p className="text-sm text-muted">
          <strong>Reclamo:</strong> disconformidad con los servicios adquiridos.
          <br />
          <strong>Queja:</strong> malestar o descontento respecto a la atención
          al público.
        </p>
        <div className="flex gap-6">
          {(["reclamo", "queja"] as const).map((type) => (
            <label key={type} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="complaintType"
                value={type}
                checked={form.complaintType === type}
                onChange={() => set("complaintType", type)}
                className="accent-primary"
              />
              <span className="capitalize">{type}</span>
            </label>
          ))}
        </div>
        <FieldError errors={fieldErrors.complaintType} />
      </fieldset>

      {/* Consumer identification */}
      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold text-primary">
          2. Identificación del Consumidor
        </legend>

        <Field
          label="Nombre completo *"
          error={fieldErrors.consumerName}
        >
          <input
            type="text"
            value={form.consumerName}
            onChange={(e) => set("consumerName", e.target.value)}
            className="form-input"
            required
          />
        </Field>

        <Field label="DNI *" error={fieldErrors.consumerDni}>
          <input
            type="text"
            inputMode="numeric"
            maxLength={8}
            value={form.consumerDni}
            onChange={(e) =>
              set("consumerDni", e.target.value.replace(/\D/g, ""))
            }
            className="form-input"
            required
          />
        </Field>

        <Field
          label="Correo electrónico *"
          error={fieldErrors.consumerEmail}
        >
          <input
            type="email"
            value={form.consumerEmail}
            onChange={(e) => set("consumerEmail", e.target.value)}
            className="form-input"
            required
          />
        </Field>

        <Field label="Teléfono" error={fieldErrors.consumerPhone}>
          <input
            type="tel"
            value={form.consumerPhone}
            onChange={(e) => set("consumerPhone", e.target.value)}
            className="form-input"
          />
        </Field>

        <Field label="Dirección" error={fieldErrors.consumerAddress}>
          <input
            type="text"
            value={form.consumerAddress}
            onChange={(e) => set("consumerAddress", e.target.value)}
            className="form-input"
          />
        </Field>

        <label className="flex items-center gap-2 cursor-pointer text-sm">
          <input
            type="checkbox"
            checked={form.consumerIsMinor}
            onChange={(e) => set("consumerIsMinor", e.target.checked)}
            className="accent-primary"
          />
          El consumidor es menor de edad
        </label>

        {form.consumerIsMinor && (
          <div className="ml-6 space-y-4 border-l-2 border-border pl-4">
            <Field
              label="Nombre del padre/tutor *"
              error={fieldErrors.guardianName}
            >
              <input
                type="text"
                value={form.guardianName}
                onChange={(e) => set("guardianName", e.target.value)}
                className="form-input"
              />
            </Field>
            <Field
              label="DNI del padre/tutor *"
              error={fieldErrors.guardianDni}
            >
              <input
                type="text"
                inputMode="numeric"
                maxLength={8}
                value={form.guardianDni}
                onChange={(e) =>
                  set("guardianDni", e.target.value.replace(/\D/g, ""))
                }
                className="form-input"
              />
            </Field>
          </div>
        )}
      </fieldset>

      {/* Complaint details */}
      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold text-primary">
          3. Detalle del {form.complaintType === "reclamo" ? "Reclamo" : "Queja"}
        </legend>

        <Field
          label="Producto o servicio contratado *"
          error={fieldErrors.productOrService}
        >
          <input
            type="text"
            value={form.productOrService}
            onChange={(e) => set("productOrService", e.target.value)}
            placeholder="Ej.: Paquete de certificación de arrendamiento"
            className="form-input"
            required
          />
        </Field>

        <Field
          label="Número de pedido o paquete (opcional)"
          error={fieldErrors.orderNumber}
        >
          <input
            type="text"
            value={form.orderNumber}
            onChange={(e) => set("orderNumber", e.target.value)}
            className="form-input"
          />
        </Field>

        <Field label="Monto reclamado (S/)" error={fieldErrors.amount}>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.amount ?? ""}
            onChange={(e) =>
              set(
                "amount",
                e.target.value ? parseFloat(e.target.value) : (undefined as unknown as number),
              )
            }
            className="form-input"
          />
        </Field>

        <Field
          label="Descripción detallada *"
          error={fieldErrors.description}
        >
          <textarea
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            rows={5}
            className="form-input resize-y"
            placeholder="Describa los hechos que motivan su reclamo o queja con el mayor detalle posible."
            required
          />
        </Field>

        <Field
          label="Pedido del consumidor (solución esperada) *"
          error={fieldErrors.requestedRemedy}
        >
          <textarea
            value={form.requestedRemedy}
            onChange={(e) => set("requestedRemedy", e.target.value)}
            rows={3}
            className="form-input resize-y"
            placeholder="Indique qué solución espera recibir."
            required
          />
        </Field>
      </fieldset>

      {/* Privacy consent */}
      <fieldset className="space-y-3">
        <legend className="text-lg font-semibold text-primary">
          4. Consentimiento
        </legend>
        <label className="flex items-start gap-3 cursor-pointer text-sm leading-relaxed">
          <input
            type="checkbox"
            checked={form.privacyConsent as boolean}
            onChange={(e) =>
              set("privacyConsent", e.target.checked as unknown as true)
            }
            className="mt-0.5 accent-primary"
          />
          <span>
            He leído y acepto la{" "}
            <a
              href="/privacidad"
              target="_blank"
              className="text-secondary underline"
            >
              Política de Privacidad
            </a>{" "}
            de VERADOC S.A.C.S. y autorizo el tratamiento de mis datos
            personales para la atención de este reclamo conforme a la Ley N°
            29733.
          </span>
        </label>
        <FieldError errors={fieldErrors.privacyConsent} />
      </fieldset>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-primary px-6 py-3 text-base font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
      >
        {isPending ? "Enviando..." : "Enviar Reclamo"}
      </button>

      <p className="text-center text-xs text-muted">
        Una vez registrado, recibirá un código único de seguimiento y una copia
        en su correo electrónico. VERADOC S.A.C.S. responderá en un plazo
        máximo de 15 días hábiles (DS 011-2011-PCM).
      </p>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-foreground">
        {label}
      </label>
      {children}
      <FieldError errors={error} />
    </div>
  );
}

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return (
    <p className="text-xs text-error">{errors[0]}</p>
  );
}

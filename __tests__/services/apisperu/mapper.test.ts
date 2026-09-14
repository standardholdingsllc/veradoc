import { describe, it, expect } from "vitest";
import {
  buildInvoicePayload,
  buildCreditNotePayload,
  limaDateTime,
  type EmitterConfig,
  type PurchaserSnapshot,
} from "@/lib/services/apisperu/mapper";

const EMITTER: EmitterConfig = {
  ruc: "20616178548",
  razonSocial: "VERADOC S.A.C.S.",
  nombreComercial: "VeraDoc",
  direccion: "Av. Ejemplo 123",
  ubigueo: "150101",
  provincia: "Lima",
  departamento: "Lima",
  distrito: "Lima",
};

describe("buildInvoicePayload", () => {
  it("builds a factura (01) with correct structure", () => {
    const purchaser: PurchaserSnapshot = {
      tipoDoc: "6",
      numDoc: "20100017491",
      razonSocial: "BANCO DE CREDITO DEL PERU",
    };

    const payload = buildInvoicePayload({
      tipoDoc: "01",
      serie: "F001",
      correlativo: "1",
      issuedAt: "2026-09-07T15:00:00.000Z",
      purchaser,
      totalCentimos: 8900,
      emitter: EMITTER,
    });

    expect(payload.tipoDoc).toBe("01");
    expect(payload.serie).toBe("F001");
    expect(payload.correlativo).toBe("1");
    expect(payload.ublVersion).toBe("2.1");
    expect(payload.tipoOperacion).toBe("0101");
    expect(payload.tipoMoneda).toBe("PEN");
    expect(payload.client.tipoDoc).toBe("6");
    expect(payload.client.numDoc).toBe("20100017491");
    expect(payload.client.rznSocial).toBe("BANCO DE CREDITO DEL PERU");
    expect(payload.company.ruc).toBe("20616178548");

    // IGV: 8900 -> 7542 + 1358
    expect(payload.mtoOperGravadas).toBe(75.42);
    expect(payload.mtoIGV).toBe(13.58);
    expect(payload.mtoImpVenta).toBe(89.0);
    expect(payload.subTotal).toBe(89.0);

    expect(payload.details).toHaveLength(1);
    expect(payload.details[0].porcentajeIgv).toBe(18);
    expect(payload.details[0].tipAfeIgv).toBe("10");

    expect(payload.legends).toHaveLength(1);
    expect(payload.legends[0].code).toBe("1000");
    expect(payload.legends[0].value).toContain("SOLES");
  });

  it("builds a boleta (03) with DNI", () => {
    const purchaser: PurchaserSnapshot = {
      tipoDoc: "1",
      numDoc: "12345678",
      razonSocial: "JUAN PEREZ",
    };

    const payload = buildInvoicePayload({
      tipoDoc: "03",
      serie: "B001",
      correlativo: "42",
      issuedAt: "2026-09-07T15:00:00.000Z",
      purchaser,
      totalCentimos: 8900,
      emitter: EMITTER,
    });

    expect(payload.tipoDoc).toBe("03");
    expect(payload.serie).toBe("B001");
    expect(payload.client.tipoDoc).toBe("1");
    expect(payload.client.numDoc).toBe("12345678");
  });

  it("produces correct totals for S/ 1.00", () => {
    const purchaser: PurchaserSnapshot = {
      tipoDoc: "1",
      numDoc: "12345678",
      razonSocial: "TEST",
    };

    const payload = buildInvoicePayload({
      tipoDoc: "03",
      serie: "B001",
      correlativo: "1",
      issuedAt: "2026-09-07T15:00:00.000Z",
      purchaser,
      totalCentimos: 100,
      emitter: EMITTER,
    });

    expect(payload.mtoOperGravadas + payload.mtoIGV).toBeCloseTo(1.0, 2);
    expect(payload.mtoImpVenta).toBe(1.0);
  });
});

describe("buildCreditNotePayload", () => {
  it("builds a credit note (07) referencing original factura", () => {
    const purchaser: PurchaserSnapshot = {
      tipoDoc: "6",
      numDoc: "20100017491",
      razonSocial: "BANCO DE CREDITO DEL PERU",
    };

    const payload = buildCreditNotePayload({
      serie: "FC01",
      correlativo: "1",
      issuedAt: "2026-09-08T10:00:00.000Z",
      originalTipoDoc: "01",
      originalSerie: "F001",
      originalCorrelativo: "1",
      purchaser,
      refundAmountCentimos: 4450,
      reasonCode: "01",
      reasonDescription: "Anulación de la operación",
      emitter: EMITTER,
    });

    expect(payload.tipoDoc).toBe("07");
    expect(payload.tipDocAfectado).toBe("01");
    expect(payload.numDocfectado).toBe("F001-1");
    expect(payload.codMotivo).toBe("01");
    expect(payload.desMotivo).toBe("Anulación de la operación");
    expect(payload.mtoImpVenta).toBe(44.50);
    expect(payload.details).toHaveLength(1);
    expect(payload.legends[0].code).toBe("1000");
  });

  it("selects B-family for boleta credit note", () => {
    const purchaser: PurchaserSnapshot = {
      tipoDoc: "1",
      numDoc: "12345678",
      razonSocial: "JUAN PEREZ",
    };

    const payload = buildCreditNotePayload({
      serie: "BB01",
      correlativo: "1",
      issuedAt: "2026-09-08T10:00:00.000Z",
      originalTipoDoc: "03",
      originalSerie: "B001",
      originalCorrelativo: "42",
      purchaser,
      refundAmountCentimos: 8900,
      reasonCode: "09",
      reasonDescription: "Descuento autorizado",
      emitter: EMITTER,
    });

    expect(payload.tipDocAfectado).toBe("03");
    expect(payload.numDocfectado).toBe("B001-42");
    expect(payload.serie).toBe("BB01");
  });
});

describe("limaDateTime", () => {
  it("formats UTC to Lima timezone (UTC-5)", () => {
    const result = limaDateTime("2026-09-07T20:30:00.000Z");
    expect(result).toContain("2026-09-07T15:30:00");
    expect(result).toContain("-05:00");
  });
});

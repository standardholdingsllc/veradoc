import { describe, expect, it } from "vitest";
import {
  buildTelemetrySql,
  evaluateTelemetryRow,
  sanitizeText,
  sanitizeUrl,
} from "@/scripts/h1-supabase-telemetry.mjs";

describe("H1 Supabase telemetry acceptance script", () => {
  it("sanitizes credential query values and signing tokens", () => {
    expect(
      sanitizeUrl(
        "https://app.veradoc.pe/firma/secret-token?code=oauth-secret&next=/agente",
      ),
    ).toBe("https://app.veradoc.pe/firma/[token]");
    expect(sanitizeText("Authorization: Bearer very-secret-token")).toBe(
      "Authorization: [redacted]",
    );
  });

  it("builds an exact-window aggregate query without returning event payloads", () => {
    const sql = buildTelemetrySql(
      "2026-09-17T05:53:09.000Z",
      "2026-09-17T05:53:34.000Z",
    );

    expect(sql).toContain("source = 'edge_logs'");
    expect(sql).toContain("/rest/v1/notary_payout_rates");
    expect(sql).toContain("payout_request_count");
    expect(sql).toContain("payout_400_count");
    expect(sql).toContain("2026-09-17T05:53:09.000Z");
    expect(sql).toContain("2026-09-17T05:53:34.000Z");
    expect(sql).not.toContain("event_message");
  });

  it("passes only with retained coverage and zero payout counters", () => {
    expect(
      evaluateTelemetryRow({
        total_edge_rows: "12",
        payout_request_count: "0",
        payout_400_count: "0",
      }),
    ).toMatchObject({ status: "PASS" });
  });

  it("does not pass when log coverage is unavailable", () => {
    expect(
      evaluateTelemetryRow({
        total_edge_rows: "0",
        payout_request_count: "0",
        payout_400_count: "0",
      }),
    ).toMatchObject({ status: "PARTIAL" });
  });

  it("fails on any payout query and prioritizes HTTP 400 evidence", () => {
    expect(
      evaluateTelemetryRow({
        total_edge_rows: "12",
        payout_request_count: "1",
        payout_400_count: "0",
      }),
    ).toMatchObject({ status: "FAIL" });
    expect(
      evaluateTelemetryRow({
        total_edge_rows: "12",
        payout_request_count: "2",
        payout_400_count: "2",
      }),
    ).toMatchObject({ status: "FAIL", totals: { payout400Count: 2 } });
  });
});

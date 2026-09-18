import { afterEach, describe, expect, it } from "vitest";
import {
  formatCalendarDate,
  formatPeruDate,
  formatPeruDateTime,
  normalizeDateOnly,
  normalizeInstant,
} from "@/lib/date-time";

const originalTimeZone = process.env.TZ;

afterEach(() => {
  process.env.TZ = originalTimeZone;
});

describe("notary packet date contract", () => {
  it("preserves valid calendar dates and rejects impossible or non-canonical dates", () => {
    expect(normalizeDateOnly("2099-01-01")).toBe("2099-01-01");
    expect(normalizeDateOnly(null)).toBeNull();
    expect(() => normalizeDateOnly("2099-02-29")).toThrow(/calendar date/);
    expect(() => normalizeDateOnly("01/01/2099")).toThrow(/calendar date/);
  });

  it("normalizes instants to an explicit UTC representation", () => {
    expect(normalizeInstant("2026-09-17T15:45:00-05:00")).toBe(
      "2026-09-17T20:45:00.000Z",
    );
    expect(normalizeInstant(null)).toBeNull();
    expect(() => normalizeInstant("not-a-timestamp")).toThrow(/timestamp/);
  });

  it("renders date-only values identically in UTC and America/Bogota", () => {
    process.env.TZ = "UTC";
    const utc = formatCalendarDate("2099-01-01");

    process.env.TZ = "America/Bogota";
    const bogota = formatCalendarDate("2099-01-01");

    expect(bogota).toBe(utc);
    expect(bogota).toContain("2099");
    expect(bogota).not.toContain("31");
  });

  it("renders instants in Peru time independently of the host timezone", () => {
    process.env.TZ = "UTC";
    const utcHost = formatPeruDateTime("2026-09-17T20:45:00.000Z");

    process.env.TZ = "Asia/Tokyo";
    const tokyoHost = formatPeruDateTime("2026-09-17T20:45:00.000Z");

    expect(tokyoHost).toBe(utcHost);
    expect(tokyoHost).toContain("03:45");
  });

  it("renders instant dates in Peru without exposing a host-timezone shift", () => {
    process.env.TZ = "UTC";
    const utcHost = formatPeruDate("2026-09-18T02:00:00.000Z");

    process.env.TZ = "Asia/Tokyo";
    const tokyoHost = formatPeruDate("2026-09-18T02:00:00.000Z");

    expect(tokyoHost).toBe(utcHost);
    expect(tokyoHost).toContain("17");
  });
});

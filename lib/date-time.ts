const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export const PERU_TIME_ZONE = "America/Lima";

const calendarDateFormatter = new Intl.DateTimeFormat("es-PE", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const peruDateTimeFormatter = new Intl.DateTimeFormat("es-PE", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: PERU_TIME_ZONE,
});

const peruDateFormatter = new Intl.DateTimeFormat("es-PE", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: PERU_TIME_ZONE,
});

export function normalizeDateOnly(value: string): string;
export function normalizeDateOnly(value: string | null | undefined): string | null;
export function normalizeDateOnly(value: string | null | undefined): string | null {
  if (value == null) return null;

  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) {
    throw new RangeError("Invalid calendar date");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    throw new RangeError("Invalid calendar date");
  }

  return `${match[1]}-${match[2]}-${match[3]}`;
}

export function normalizeInstant(value: string): string;
export function normalizeInstant(value: string | null | undefined): string | null;
export function normalizeInstant(value: string | null | undefined): string | null {
  if (value == null) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError("Invalid timestamp");
  }

  return date.toISOString();
}

export function formatCalendarDate(value: string | null | undefined): string {
  if (value == null) return "—";
  const normalized = normalizeDateOnly(value);
  return calendarDateFormatter.format(new Date(`${normalized}T00:00:00.000Z`));
}

export function formatPeruDateTime(value: string | null | undefined): string {
  if (value == null) return "—";
  return peruDateTimeFormatter.format(new Date(normalizeInstant(value)));
}

export function formatPeruDate(value: string | null | undefined): string {
  if (value == null) return "—";
  return peruDateFormatter.format(new Date(normalizeInstant(value)));
}

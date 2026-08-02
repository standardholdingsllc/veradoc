import "server-only";

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const tokenLookupAttempts = new Map<string, RateLimitEntry>();

const MAX_ATTEMPTS = 10;
const WINDOW_MS = 60 * 1000; // 1 minute

/**
 * In-memory sliding-window rate limiter for token lookups.
 * Keyed by identifier (token hash or IP address).
 * Throws if the limit is exceeded within the window.
 *
 * For production at scale, replace with Redis or a Supabase-backed counter.
 */
export function enforceTokenLookupRateLimit(identifier: string): void {
  const now = Date.now();
  const entry = tokenLookupAttempts.get(identifier);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    tokenLookupAttempts.set(identifier, { count: 1, windowStart: now });
    return;
  }

  entry.count++;

  if (entry.count > MAX_ATTEMPTS) {
    throw new RateLimitError(
      "Demasiados intentos. Por favor, intenta de nuevo en unos minutos.",
    );
  }
}

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitError";
  }
}

/**
 * Periodic cleanup to prevent unbounded memory growth.
 * Call on a timer or let the GC handle it for low-traffic MVPs.
 */
export function pruneExpiredEntries(): void {
  const now = Date.now();
  for (const [key, entry] of tokenLookupAttempts) {
    if (now - entry.windowStart > WINDOW_MS) {
      tokenLookupAttempts.delete(key);
    }
  }
}

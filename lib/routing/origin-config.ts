import { z } from "zod";
import type { CanonicalSurface, PublicTarget } from "./types";

export type OriginMap = Record<CanonicalSurface, string>;

const originSchema = z
  .string()
  .url()
  .transform((value, context) => {
    const parsed = new URL(value);
    if (
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash ||
      (parsed.pathname !== "/" && parsed.pathname !== "")
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Origins must not include credentials, paths, query strings, or fragments",
      });
      return z.NEVER;
    }
    return parsed.origin;
  });

export function parseOriginMap(
  values: Record<CanonicalSurface, string>,
  options: { requireHttps: boolean },
): OriginMap {
  const parsed = Object.fromEntries(
    Object.entries(values).map(([surface, value]) => {
      const origin = originSchema.parse(value);
      if (options.requireHttps && new URL(origin).protocol !== "https:") {
        throw new Error(
          `${surface.toUpperCase()}_ORIGIN must use HTTPS in production`,
        );
      }
      return [surface, origin];
    }),
  ) as OriginMap;
  return parsed;
}

export function buildAbsoluteUrlFromOrigins(
  origins: OriginMap,
  target: PublicTarget,
  query?: Record<string, string | undefined>,
): string {
  if (!target.path.startsWith("/") || target.path.startsWith("//")) {
    throw new Error("Public paths must start with exactly one slash");
  }

  const url = new URL(target.path, origins[target.surface]);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, value);
  }
  return url.toString();
}

import type { CanonicalSurface, Surface } from "./types";

export const PRODUCTION_HOSTS = {
  marketing: "veradoc.pe",
  app: "app.veradoc.pe",
  notary: "notario.veradoc.pe",
  admin: "admin.veradoc.pe",
  demo: "demo.veradoc.pe",
} as const satisfies Record<CanonicalSurface, string>;

const LOCAL_SUBDOMAIN_SURFACES: Record<string, CanonicalSurface> = {
  app: "app",
  notario: "notary",
  admin: "admin",
  demo: "demo",
};

export interface HostClassificationOptions {
  vercelEnvironment?: string;
  vercelHostname?: string | string[];
  isolatedDemoDeployment?: boolean;
}

export interface HostClassification {
  hostname: string | null;
  surface: Surface;
  isWww: boolean;
  isProductionDeploymentHost: boolean;
}

export function normalizeHostname(
  value: string | null | undefined,
): string | null {
  if (!value) return null;

  const candidate = value.trim();
  if (!candidate || /[\s/@?#\\]/.test(candidate)) return null;

  try {
    const parsed = new URL(`http://${candidate}`);
    let hostname = parsed.hostname.toLowerCase();
    if (hostname.endsWith(".")) hostname = hostname.slice(0, -1);
    if (
      hostname !== "[::1]" &&
      !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(
        hostname,
      )
    ) {
      return null;
    }
    return hostname || null;
  } catch {
    return null;
  }
}

export function classifyHost(
  value: string | null | undefined,
  options: HostClassificationOptions = {},
): HostClassification {
  const hostname = normalizeHostname(value);
  if (!hostname) {
    return {
      hostname: null,
      surface: "unknown",
      isWww: false,
      isProductionDeploymentHost: false,
    };
  }

  if (hostname === "www.veradoc.pe") {
    return {
      hostname,
      surface: "marketing",
      isWww: true,
      isProductionDeploymentHost: false,
    };
  }

  for (const [surface, expectedHostname] of Object.entries(PRODUCTION_HOSTS)) {
    if (hostname === expectedHostname) {
      return {
        hostname,
        surface: surface as CanonicalSurface,
        isWww: false,
        isProductionDeploymentHost: false,
      };
    }
  }

  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]"
  ) {
    return {
      hostname,
      surface: "local",
      isWww: false,
      isProductionDeploymentHost: false,
    };
  }

  if (hostname.endsWith(".localhost")) {
    const label = hostname.slice(0, -".localhost".length);
    return {
      hostname,
      surface: LOCAL_SUBDOMAIN_SURFACES[label] ?? "local",
      isWww: false,
      isProductionDeploymentHost: false,
    };
  }

  const configuredVercelHostnames = (
    Array.isArray(options.vercelHostname)
      ? options.vercelHostname
      : [options.vercelHostname]
  )
    .map(normalizeHostname)
    .filter((item): item is string => Boolean(item));
  const isProductionDeploymentHost =
    configuredVercelHostnames.includes(hostname);
  if (isProductionDeploymentHost) {
    return {
      hostname,
      surface: options.isolatedDemoDeployment ? "demo" : "preview",
      isWww: false,
      isProductionDeploymentHost: true,
    };
  }

  if (
    options.vercelEnvironment !== "production" &&
    hostname.endsWith(".vercel.app")
  ) {
    return {
      hostname,
      surface: "preview",
      isWww: false,
      isProductionDeploymentHost: false,
    };
  }

  return {
    hostname,
    surface: "unknown",
    isWww: false,
    isProductionDeploymentHost: false,
  };
}

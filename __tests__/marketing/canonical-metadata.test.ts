import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/components/legal/complaint-form", () => ({
  ComplaintForm: () => null,
}));
vi.mock("@/lib/routing/origins", () => ({
  buildAbsoluteUrl: ({ path }: { path: string }) => `https://veradoc.pe${path}`,
}));

const routes = [
  ["/", () => import("@/app/(marketing)/page")],
  ["/como-funciona", () => import("@/app/(marketing)/como-funciona/page")],
  ["/devoluciones", () => import("@/app/(marketing)/devoluciones/page")],
  ["/evidencia", () => import("@/app/(marketing)/evidencia/page")],
  [
    "/libro-de-reclamaciones",
    () => import("@/app/(marketing)/libro-de-reclamaciones/page"),
  ],
  [
    "/posicionamiento-legal",
    () => import("@/app/(marketing)/posicionamiento-legal/page"),
  ],
  ["/precios", () => import("@/app/(marketing)/precios/page")],
  ["/privacidad", () => import("@/app/(marketing)/privacidad/page")],
  ["/terminos", () => import("@/app/(marketing)/terminos/page")],
] as const;

describe("marketing canonical metadata", () => {
  it.each(routes)("publishes canonical and Open Graph URLs for %s", async (path, loadPage) => {
    const page = await loadPage();
    const expectedUrl = `https://veradoc.pe${path}`;

    expect(page.metadata.alternates?.canonical).toBe(expectedUrl);
    expect(page.metadata.openGraph?.url).toBe(expectedUrl);
    expect(page.metadata.openGraph).toMatchObject({
      title: page.metadata.title,
      description: page.metadata.description,
      locale: "es_PE",
      type: "website",
      siteName: "VeraDoc.pe",
    });
  });
});

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminLogoutButton } from "@/components/admin/admin-logout-button";

describe("AdminLogoutButton", () => {
  it("renders an accessible product-level logout submit control", () => {
    const html = renderToStaticMarkup(
      <form>
        <AdminLogoutButton />
      </form>,
    );

    expect(html).toContain('type="submit"');
    expect(html).toContain("Cerrar sesión");
    expect(html).toContain('aria-disabled="false"');
    expect(html).not.toMatch(/<button[^>]*\sdisabled(?:=|>)/);
  });
});

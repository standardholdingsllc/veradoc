import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

async function source(relativePath: string) {
  return readFile(path.join(process.cwd(), relativePath), "utf8");
}

describe("notary invitation removal", () => {
  it("does not load invitation data while rendering the admin dashboard", async () => {
    const [page, queries] = await Promise.all([
      source("app/(dashboard)/admin/page.tsx"),
      source("lib/admin/queries.ts"),
    ]);

    expect(page).not.toContain("getInvitations");
    expect(page).not.toContain("invitations=");
    expect(queries).not.toContain('.from("invitations")');
  });

  it("contains no runtime Supabase notary-invite call", async () => {
    const [adminActions, authActions] = await Promise.all([
      source("lib/admin/actions.ts"),
      source("lib/auth/actions.ts"),
    ]);

    expect(adminActions).not.toContain("inviteUserByEmail");
    expect(adminActions).not.toContain('.from("invitations")');
    expect(authActions).not.toContain("lookup_invitation");
  });

  it("does not deploy a custom invitation email template", async () => {
    const [config, deployScript] = await Promise.all([
      source("supabase/config.toml"),
      source("scripts/deploy-email-templates.sh"),
    ]);

    expect(config).not.toContain("template.invite");
    expect(deployScript).not.toContain("mailer_templates_invite");
    expect(deployScript).not.toContain("invite.html");
  });

  it("defines a forward-only schema removal with a pending-row gate", async () => {
    const migration = await source(
      "supabase/migrations/20260918230000_remove_notary_invitations.sql",
    );
    const assertion = migration.indexOf("where status = 'pending'");
    const functionDrop = migration.indexOf(
      "drop function public.lookup_invitation(text)",
    );
    const tableDrop = migration.indexOf("drop table public.invitations");
    const columnDrop = migration.indexOf(
      "alter table public.profiles drop column invited_by",
    );

    expect(assertion).toBeGreaterThan(-1);
    expect(functionDrop).toBeGreaterThan(assertion);
    expect(tableDrop).toBeGreaterThan(functionDrop);
    expect(columnDrop).toBeGreaterThan(tableDrop);
  });

  it("removes invitation schema objects from generated database types", async () => {
    const types = await source("lib/supabase/database.types.ts");

    expect(types).not.toContain("invitations:");
    expect(types).not.toContain("lookup_invitation:");
    expect(types).not.toContain("invited_by:");
    expect(types).not.toContain("profiles_invited_by_fkey");
  });
});

import { describe, expect, it } from "vitest";
import { createSupabaseCookieOptions } from "@/lib/supabase/cookie-options";

describe("Supabase auth cookie policy", () => {
  it("sets Secure in production without widening cookies to the parent domain", () => {
    const options = createSupabaseCookieOptions(true);

    expect(options).toMatchObject({
      path: "/",
      sameSite: "lax",
      secure: true,
    });
    expect(options).not.toHaveProperty("domain");
  });

  it("keeps local HTTP development usable", () => {
    expect(createSupabaseCookieOptions(false).secure).toBe(false);
  });
});

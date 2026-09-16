import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env/public";
import { SUPABASE_COOKIE_OPTIONS } from "./cookie-options";
import type { Database } from "./database.types";

export function createClient() {
  return createBrowserClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { cookieOptions: SUPABASE_COOKIE_OPTIONS },
  );
}

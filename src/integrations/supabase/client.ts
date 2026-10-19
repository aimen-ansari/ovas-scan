import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
const url = import.meta.env.VITE_SUPABASE_URL || "";
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
export const isSupabaseConfigured = Boolean(url && key && !key.startsWith("sb_secret_") && !key.includes("YOUR_"));
let client: ReturnType<typeof createClient<Database>> | undefined;
export const supabase = new Proxy({} as ReturnType<typeof createClient<Database>>, {
  get(_, prop) {
    if (!isSupabaseConfigured) throw new Error("Cloud accounts are not configured. You can still explore the workspace.");
    client ??= createClient<Database>(url, key, { global: { fetch: (input, init) => fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(12000) }) }, auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    return Reflect.get(client, prop);
  },
});

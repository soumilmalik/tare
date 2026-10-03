import { createBrowserClient } from "@supabase/ssr";

/** Supabase client for client components (a shared singleton in the browser). */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}

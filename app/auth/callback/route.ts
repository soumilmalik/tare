import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Google sends the user back here; swap the one-time code for a session. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/`);
  }

  // Supabase reports a rejected signup (email not on the access list) as a
  // "Database error saving new user".
  const description = searchParams.get("error_description") ?? "";
  const reason = /saving new user|not_allowed/i.test(description) ? "not_allowed" : "failed";
  return NextResponse.redirect(`${origin}/login?error=${reason}`);
}

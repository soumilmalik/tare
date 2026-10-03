import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Everything except static files, the service worker, the manifest and icons.
    "/((?!_next/static|_next/image|sw.js|swe-worker|manifest.webmanifest|icons/|icon.svg|apple-icon.png|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt)$).*)",
  ],
};

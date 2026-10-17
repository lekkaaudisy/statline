import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Every page except Next.js files, the PWA manifest, icons and images.
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icon.png|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

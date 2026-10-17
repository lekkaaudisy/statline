import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// The link in the confirmation email lands here.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const code = params.get("code");
  const supabase = await createClient();

  const toLogin = (notice: string) =>
    NextResponse.redirect(new URL(`/login?notice=${notice}`, request.url));

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    return error ? toLogin("confirm-failed") : NextResponse.redirect(new URL("/", request.url));
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/", request.url));
    // Supabase has already confirmed the email before sending a code. The
    // exchange fails when the link opens in a different browser from the one
    // used to sign up (common on phones), so ask the user to log in.
    return toLogin("confirmed");
  }

  return toLogin("confirm-failed");
}

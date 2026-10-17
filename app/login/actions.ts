"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthFormState = {
  error?: string;
  message?: string;
};

const MIN_PASSWORD_LENGTH = 8;

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function logIn(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = field(formData, "email");
  const password = formData.get("password");
  if (!email || typeof password !== "string" || !password) {
    return { error: "Enter your email and password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.code === "email_not_confirmed") {
      return { error: "Confirm your email first. Check your inbox." };
    }
    return { error: "Email or password is incorrect." };
  }
  redirect("/");
}

export async function signUp(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const displayName = field(formData, "displayName");
  const email = field(formData, "email");
  const password = formData.get("password");

  if (!displayName || displayName.length > 40) {
    return { error: "Display name must be 1 to 40 characters." };
  }
  if (!email) return { error: "Enter your email." };
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return {
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    };
  }

  const origin = (await headers()).get("origin") ?? "";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
      emailRedirectTo: `${origin}/auth/confirm`,
    },
  });
  if (error) {
    if (error.code === "over_email_send_rate_limit") {
      return { error: "Too many emails sent. Wait an hour and try again." };
    }
    return { error: error.message };
  }

  // If email confirmation is turned off in Supabase, the user is logged in now.
  if (data.session) redirect("/");

  return {
    message:
      "Check your email and tap the confirmation link. Then come back here and log in.",
  };
}

export async function logOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

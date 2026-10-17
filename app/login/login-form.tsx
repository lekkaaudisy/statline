"use client";

import { useActionState, useState } from "react";
import { logIn, signUp, type AuthFormState } from "./actions";

type Mode = "login" | "signup";

const inputClass =
  "mt-1 block min-h-11 w-full rounded-md border border-accent/30 bg-background px-3 text-base text-foreground placeholder:text-muted focus:border-accent focus:outline-none";
const labelClass = "block text-sm font-medium text-muted";

export function LoginForm({ notice }: { notice?: string }) {
  const [mode, setMode] = useState<Mode>("login");
  const [loginState, loginAction, loginPending] = useActionState<
    AuthFormState,
    FormData
  >(logIn, {});
  const [signupState, signupAction, signupPending] = useActionState<
    AuthFormState,
    FormData
  >(signUp, {});

  const state = mode === "login" ? loginState : signupState;
  const pending = mode === "login" ? loginPending : signupPending;

  return (
    <div>
      <div className="grid grid-cols-2 gap-2" role="tablist">
        {(["login", "signup"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={mode === tab}
            onClick={() => setMode(tab)}
            className={`min-h-11 rounded-md font-display text-sm font-medium uppercase tracking-wider ${
              mode === tab
                ? "bg-accent text-background"
                : "border border-accent/30 text-muted"
            }`}
          >
            {tab === "login" ? "Log in" : "Create account"}
          </button>
        ))}
      </div>

      {notice && !state.error && !state.message && (
        <p className="mt-4 rounded-md border border-accent/40 p-3 text-sm text-foreground">
          {notice}
        </p>
      )}

      <form
        key={mode}
        action={mode === "login" ? loginAction : signupAction}
        className="mt-5 space-y-4"
      >
        {mode === "signup" && (
          <label className={labelClass}>
            Display name
            <input
              name="displayName"
              type="text"
              required
              maxLength={40}
              autoComplete="nickname"
              className={inputClass}
            />
          </label>
        )}
        <label className={labelClass}>
          Email
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          Password
          <input
            name="password"
            type="password"
            required
            minLength={mode === "signup" ? 8 : undefined}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            className={inputClass}
          />
        </label>

        {state.error && (
          <p role="alert" className="text-sm text-gold">
            {state.error}
          </p>
        )}
        {state.message && (
          <p role="status" className="text-sm text-accent">
            {state.message}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="min-h-11 w-full rounded-md bg-accent font-display font-bold uppercase tracking-wider text-background disabled:opacity-60"
        >
          {pending ? "Please wait" : mode === "login" ? "Log in" : "Create account"}
        </button>
      </form>
    </div>
  );
}

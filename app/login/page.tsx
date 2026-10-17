import { Suspense } from "react";
import { LoginForm } from "./login-form";

const NOTICES: Record<string, string> = {
  confirmed: "Email confirmed. Log in to continue.",
  "confirm-failed":
    "That confirmation link did not work. It may have expired. Try logging in, or create the account again.",
};

async function LoginFormWithNotice({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const { notice } = await searchParams;
  return <LoginForm notice={notice ? NOTICES[notice] : undefined} />;
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <section className="w-full max-w-sm rounded-lg border border-accent/40 bg-panel p-6 shadow-[0_0_24px_rgba(94,209,240,0.12)]">
        <p className="font-display text-xs font-medium uppercase tracking-[0.3em] text-accent">
          System
        </p>
        <h1 className="mt-2 mb-6 font-display text-4xl font-bold tracking-wide text-foreground">
          Statline
        </h1>
        <Suspense fallback={<LoginForm />}>
          <LoginFormWithNotice
            searchParams={searchParams as Promise<{ notice?: string }>}
          />
        </Suspense>
      </section>
    </main>
  );
}

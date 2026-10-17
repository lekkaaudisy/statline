import { Suspense } from "react";
import { logOut } from "./login/actions";
import { createClient } from "@/lib/supabase/server";

async function Status() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims.sub;

  // Deliberately unfiltered: Row Level Security alone limits what comes back,
  // so this count proves a user can only see their own profile.
  const { data: profiles, count } = await supabase
    .from("profiles")
    .select("id, display_name", { count: "exact" });
  const me = profiles?.find((profile) => profile.id === userId);

  return (
    <>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-wide text-foreground">
        Welcome, {me?.display_name ?? "Player"}
      </h1>
      <p className="mt-4 text-base text-muted">
        The system is being prepared. Quests will appear here soon.
      </p>
      <p className="mt-6 rounded-md border border-accent/30 p-3 text-sm text-muted">
        Privacy check: profiles visible to you:{" "}
        <span className="font-display font-bold text-accent">{count ?? 0}</span>
      </p>
    </>
  );
}

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <section className="w-full max-w-sm rounded-lg border border-accent/40 bg-panel p-6 shadow-[0_0_24px_rgba(94,209,240,0.12)]">
        <p className="font-display text-xs font-medium uppercase tracking-[0.3em] text-accent">
          System
        </p>
        <Suspense
          fallback={<p className="mt-2 text-base text-muted">Loading status</p>}
        >
          <Status />
        </Suspense>
        <form action={logOut} className="mt-6">
          <button
            type="submit"
            className="min-h-11 w-full rounded-md border border-accent/40 font-display text-sm font-medium uppercase tracking-wider text-accent"
          >
            Log out
          </button>
        </form>
      </section>
    </main>
  );
}

import { redirect } from "next/navigation";
import { Suspense } from "react";
import { logOut } from "./login/actions";
import { StatusWindow, type StatRow } from "./status-window";
import { CLASS_INFO, isClassId } from "@/lib/game/classes";
import { createClient } from "@/lib/supabase/server";

async function Status() {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, main_class, second_class, onboarded_at")
    .maybeSingle();

  // New players go through onboarding first.
  if (!profile?.onboarded_at) redirect("/onboarding");

  const { data: stats } = await supabase
    .from("stats")
    .select("stat, points, provisional");

  const classNames = [profile.main_class, profile.second_class]
    .filter(isClassId)
    .map((id) => CLASS_INFO[id].name)
    .join(" + ");

  return (
    <>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-wide text-foreground">
        {profile.display_name}
      </h1>
      <p className="mt-1 text-sm text-muted">Class: {classNames}</p>
      <StatusWindow rows={(stats ?? []) as StatRow[]} />
    </>
  );
}

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <section className="w-full max-w-sm rounded-lg border border-accent/40 bg-panel p-6 shadow-[0_0_24px_rgba(94,209,240,0.12)]">
        <p className="font-display text-xs font-medium uppercase tracking-[0.3em] text-accent">
          Status
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

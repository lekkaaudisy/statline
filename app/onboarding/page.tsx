import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { OnboardingFlow } from "./onboarding-flow";

async function Onboarding() {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, onboarded_at")
    .maybeSingle();

  // Onboarding happens once. After that, go straight to the status window.
  if (profile?.onboarded_at) redirect("/");

  return <OnboardingFlow displayName={profile?.display_name ?? "Player"} />;
}

export default function OnboardingPage() {
  return (
    <main className="flex flex-1 justify-center px-4 py-8">
      <Suspense
        fallback={<p className="mt-12 text-base text-muted">Loading</p>}
      >
        <Onboarding />
      </Suspense>
    </main>
  );
}

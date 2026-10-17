import Link from "next/link";
import { Suspense } from "react";
import { AppShell } from "../../app-shell";
import { REWARD_TIERS, TREAT_EXAMPLES } from "@/lib/game/rewards";
import { loadTreats } from "@/lib/supabase/cards";
import { createClient } from "@/lib/supabase/server";
import { RewardForm } from "./reward-form";

async function Rewards() {
  const supabase = await createClient();
  const treats = await loadTreats(supabase);
  return (
    <div className="flex flex-col gap-5">
      <Link href="/cards" className="flex min-h-11 items-center text-sm text-accent">
        Back to cards
      </Link>
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-sm tracking-[0.15em] text-accent">REWARD TREATS</h1>
        <p className="text-sm leading-normal text-muted">
          Set a treat for each card tier. When a quest drops a Reward card of
          that tier, you can redeem it for the treat. Harder quests pay
          higher tiers, so save the bigger treats for them. A tier with no
          treat never drops Reward cards.
        </p>
      </div>
      <RewardForm
        tiers={REWARD_TIERS.map((tier) => ({
          tier,
          treat: treats[tier] ?? "",
          example: TREAT_EXAMPLES[tier] ?? "",
        }))}
      />
    </div>
  );
}

export default function RewardsPage() {
  return (
    <AppShell active="cards">
      <Suspense fallback={<p className="text-base text-muted">Loading treats</p>}>
        <Rewards />
      </Suspense>
    </AppShell>
  );
}

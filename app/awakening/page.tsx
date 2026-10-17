import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CardTile } from "../cards/card-tile";
import { cardView } from "../cards/card-view";
import {
  AWAKENING_INACTIVE_DAYS,
  AWAKENING_STAT_BOOST,
  AWAKENING_STEADY_DAYS,
} from "@/lib/game/constants";
import { toIsoDate } from "@/lib/game/dates";
import { EARNED_STATS, STAT_INFO } from "@/lib/game/stats";
import { awakenIfReady, type AwakeningGain } from "@/lib/supabase/calibration";
import { loadProofCard } from "@/lib/supabase/cards";
import { createClient } from "@/lib/supabase/server";

// The Awakening moment: a full-screen System window with the stat boost and
// the Exclusive Proof card. Given once; a later visit shows it again.
async function Awakening() {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarded_at, sick_since, awakened_on")
    .maybeSingle();
  if (!profile?.onboarded_at) redirect("/onboarding");

  let gains: AwakeningGain[] | null = null;
  if (!profile.awakened_on) {
    const result = await awakenIfReady(supabase, {
      onboardedOn: toIsoDate(new Date(profile.onboarded_at)),
      today: toIsoDate(new Date()),
      sickSince: profile.sick_since ?? null,
    });
    if (result.status === "not-ready") redirect("/");
    // Not back to the status window, which would send the user here again.
    if (result.status === "error") {
      return (
        <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
          <p className="text-sm leading-normal">
            The System could not record your Awakening just now. Try again in a moment.
          </p>
          <Link href="/quests" className="flex min-h-11 items-center text-sm text-accent">
            Go to quests
          </Link>
        </div>
      );
    }
    gains = result.gains;
  }
  const card = await loadProofCard(supabase, "exclusive");

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-5 px-6 py-10 text-center">
      <p className="font-display text-sm tracking-[0.3em] text-gold">THE SYSTEM RECOGNISES YOU</p>
      <h1 className="font-display text-4xl font-bold tracking-wider text-accent">AWAKENING</h1>
      <p className="max-w-sm text-sm leading-normal text-[#c3cedb]">
        You stepped away for {AWAKENING_INACTIVE_DAYS} days or more, then came back and kept
        going for {AWAKENING_STEADY_DAYS} days. That return is its own kind of strength.
      </p>

      <ul className="flex w-full max-w-xs flex-col gap-2 rounded-[14px] border border-line bg-panel p-4 text-left">
        {EARNED_STATS.map((stat) => {
          const gain = gains?.find((g) => g.stat === stat);
          return (
            <li key={stat} className="flex items-baseline justify-between gap-3">
              <span className="text-[15px] font-semibold">{STAT_INFO[stat].name}</span>
              <span className="font-display text-accent">
                +{AWAKENING_STAT_BOOST}
                {gain && gain.before !== gain.after && (
                  <span className="ml-2 text-gold">
                    {gain.before} to {gain.after}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      {card && (
        <>
          <p className="font-display text-sm tracking-[0.3em] text-gold">EXCLUSIVE CARD EARNED</p>
          <CardTile card={cardView(card)} size="large" />
        </>
      )}

      <Link
        href="/"
        className="flex min-h-12 items-center justify-center rounded-[10px] border border-accent bg-[#0f2230] px-7 font-display text-[15px] font-semibold tracking-wider"
      >
        CONTINUE
      </Link>
    </div>
  );
}

export default function AwakeningPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <Suspense fallback={<p className="mt-12 text-center text-base text-muted">Loading</p>}>
        <Awakening />
      </Suspense>
    </main>
  );
}

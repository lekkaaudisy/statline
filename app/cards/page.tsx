import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppShell } from "../app-shell";
import { cardUseError, questlineProgress, rerollTargets, restTargets } from "@/lib/game/card-effects";
import { isProofCard } from "@/lib/game/cards";
import { HAND_SIZE } from "@/lib/game/constants";
import { handCards } from "@/lib/game/hand";
import { isRestDay } from "@/lib/game/rest-day";
import { getQuestline } from "@/lib/game/skill-questlines";
import { devToolsFlagOn } from "@/lib/dev-tools";
import { prepareQuestDay } from "@/lib/supabase/quests";
import { createClient } from "@/lib/supabase/server";
import { cardView } from "./card-view";
import { HandView, type InPlay } from "./hand-view";

async function Hand() {
  const supabase = await createClient();
  // Same preparation as the quest list, so penalties and shields are settled
  // and today's quests exist before any card is used on them.
  const day = await prepareQuestDay(supabase);
  if (!day) redirect("/onboarding");
  const { today, quests, cards, restDays } = day;
  const restToday = isRestDay(restDays, today);
  const context = { today, quests, cards, restToday };

  const hand = handCards(cards).map((c) => ({
    ...cardView(c),
    blocked: cardUseError(c, context),
  }));
  const pending = cards.filter((c) => c.status === "pending").map(cardView);
  const proof = cards.filter((c) => isProofCard(c) && c.status === "held").map(cardView);

  const inPlay: InPlay[] = cards
    .filter((c) => c.status === "active")
    .map((c) => {
      if (c.kind === "double_xp") {
        return { id: c.id, tier: c.tier, title: "Double XP active", detail: "Your next cleared quest counts twice." };
      }
      if (c.kind === "shield") {
        return { id: c.id, tier: c.tier, title: "Shield up", detail: "The next day you miss carries no penalty." };
      }
      const progress = questlineProgress(c);
      return {
        id: c.id,
        tier: c.tier,
        title: getQuestline(c.questlineId ?? "")?.name ?? "Questline",
        detail: progress
          ? `Step ${progress.step} of ${progress.total} cleared. Today's step is on your quest list.`
          : "Open questline.",
      };
    });

  const devTester = devToolsFlagOn()
    ? (await supabase.from("dev_testers").select("user_id").maybeSingle()).data
    : null;

  return (
    <HandView
      hand={hand}
      handSize={HAND_SIZE}
      pending={pending}
      proof={proof}
      inPlay={inPlay}
      rerollQuests={rerollTargets(quests, today).map((q) => ({ id: q.id, title: q.title, type: q.type }))}
      restCount={restTargets(quests, today).length}
      devTester={Boolean(devTester)}
    />
  );
}

export default function CardsPage() {
  return (
    <AppShell active="cards">
      <Suspense fallback={<p className="text-base text-muted">Loading cards</p>}>
        <Hand />
      </Suspense>
    </AppShell>
  );
}

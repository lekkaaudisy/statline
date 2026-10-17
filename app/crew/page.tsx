import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppShell } from "../app-shell";
import { confirmationTopUp, rankLeaderboard } from "@/lib/game/crew";
import { CONTRIBUTION_POINTS, CREW_MAX_MEMBERS } from "@/lib/game/constants";
import { toIsoDate, weekStart } from "@/lib/game/dates";
import { PROOF_INFO } from "@/lib/game/proof";
import { STAT_INFO } from "@/lib/game/stats";
import {
  loadConfirmationRequests,
  loadCrew,
  loadCrewMembers,
  loadWeekCounts,
} from "@/lib/supabase/crew";
import { currentUserId } from "@/lib/supabase/quests";
import { createClient } from "@/lib/supabase/server";
import { ConfirmRequests } from "./confirm-requests";
import { CrewSetup } from "./crew-setup";
import { InviteCode } from "./invite-code";
import { Leaderboard } from "./leaderboard";
import { LeaveButton } from "./leave-button";
import { MemberList } from "./member-list";

function SectionTitle({ children, aside }: { children: string; aside?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="font-display text-sm tracking-[0.15em] text-accent">{children}</h2>
      {aside && <span className="text-[13px] text-muted">{aside}</span>}
    </div>
  );
}

async function CrewScreen() {
  const supabase = await createClient();
  const [userId, { data: profile }, crew] = await Promise.all([
    currentUserId(supabase),
    supabase.from("profiles").select("onboarded_at").maybeSingle(),
    loadCrew(supabase),
  ]);
  if (!userId) redirect("/login");
  if (!profile?.onboarded_at) redirect("/onboarding");
  if (!crew) return <CrewSetup />;

  const monday = weekStart(toIsoDate(new Date()));
  const [members, counts, requests] = await Promise.all([
    loadCrewMembers(supabase),
    loadWeekCounts(supabase, monday),
    loadConfirmationRequests(supabase),
  ]);
  const owner = members.some((m) => m.userId === userId && m.role === "owner");
  const board = rankLeaderboard(
    members.map((m) => ({
      userId: m.userId,
      name: m.name,
      counts: counts.get(m.userId) ?? { questsCleared: 0, proofsConfirmed: 0, cardsGifted: 0 },
    })),
  );

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3 rounded-xl border border-[#243349] bg-panel p-4">
        <span className="font-display text-xs tracking-[0.25em] text-accent">CREW</span>
        <h1 className="font-display text-2xl font-bold">{crew.name}</h1>
        <InviteCode code={crew.inviteCode} crewName={crew.name} owner={owner} />
      </section>

      {requests.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionTitle aside={`${requests.length} waiting`}>CONFIRM QUESTS</SectionTitle>
          <ConfirmRequests
            requests={requests.map((r) => ({
              questId: r.questId,
              name: r.name,
              title: r.title,
              statName: STAT_INFO[r.stat].name,
              rank: r.rank,
              proofName: PROOF_INFO[r.proofType].name,
              summary: r.summary,
              topUp: confirmationTopUp(r),
            }))}
          />
        </section>
      )}

      <section className="flex flex-col gap-3">
        <SectionTitle aside="Resets Monday">THIS WEEK</SectionTitle>
        <Leaderboard rows={board} userId={userId} />
        <p className="text-xs leading-normal text-muted">
          Ranked by effort for the crew: {CONTRIBUTION_POINTS.questCleared} per
          quest cleared, {CONTRIBUTION_POINTS.proofConfirmed} per crewmate&apos;s
          quest confirmed, {CONTRIBUTION_POINTS.cardGifted} per card gifted.
          Stats and grades never count.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <SectionTitle aside={`${members.length} / ${CREW_MAX_MEMBERS}`}>MEMBERS</SectionTitle>
        <MemberList members={members} userId={userId} />
        <p className="text-xs leading-normal text-muted">
          Crewmates see only letter grades, never points or quests.
        </p>
      </section>

      <LeaveButton owner={owner} />
    </div>
  );
}

export default function CrewPage() {
  return (
    <AppShell active="crew">
      <Suspense fallback={<p className="text-base text-muted">Loading crew</p>}>
        <CrewScreen />
      </Suspense>
    </AppShell>
  );
}

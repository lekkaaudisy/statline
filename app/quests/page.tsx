import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppShell } from "../app-shell";
import { DevPassDay } from "../dev/dev-panel";
import {
  REST_DAY_POINTS,
  USER_SIDE_QUESTS_PER_DAY,
} from "@/lib/game/constants";
import { weekStart } from "@/lib/game/dates";
import { canTakeRestDay, isRestDay, restDayThisWeek } from "@/lib/game/rest-day";
import { devToolsFlagOn } from "@/lib/dev-tools";
import { completedOn, prepareQuestDay, type Quest } from "@/lib/supabase/quests";
import { createClient } from "@/lib/supabase/server";
import { QuestCard } from "./quest-card";
import { RestDayButton } from "./rest-day-button";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function weekday(date: string): string {
  return WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
}

function SectionTitle({ children, aside }: { children: string; aside?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="font-display text-sm tracking-[0.15em] text-accent">{children}</h2>
      {aside && <span className="text-[13px] text-muted">{aside}</span>}
    </div>
  );
}

async function Quests() {
  const supabase = await createClient();
  const day = await prepareQuestDay(supabase);
  if (!day) redirect("/onboarding");
  const { today, quests, restDays, rank, sick } = day;

  const monday = weekStart(today);
  const dailies = quests.filter((q) => q.type === "daily" && q.issuedOn === today);
  const main = quests.filter((q) => q.type === "main" && q.issuedOn >= monday).at(-1);
  const clearedToday = (q: Quest) => q.status === "cleared" && completedOn(q) === today;
  const sides = quests.filter(
    (q) =>
      q.type === "side" &&
      ((q.source === "system" && q.issuedOn === today) ||
        (q.source === "user" && ((q.status === "open" && q.dueOn >= today) || clearedToday(q)))),
  );
  const cleared = quests.filter(clearedToday).length;
  const madeToday = quests.filter((q) => q.source === "user" && q.issuedOn === today).length;
  const restToday = isRestDay(restDays, today);
  const restTaken = restDayThisWeek(restDays, today);
  const devTester = devToolsFlagOn()
    ? (await supabase.from("dev_testers").select("user_id").maybeSingle()).data
    : null;

  return (
    <div className="flex flex-col gap-6">
      {sick && (
        <p className="rounded-[10px] border border-accent bg-[#0f2230] px-3.5 py-3 text-sm">
          Sick or injured: missed quests are excused and decay is paused. Rest well.
        </p>
      )}

      <section className="flex flex-col gap-3">
        <SectionTitle aside={`${cleared} cleared today`}>TODAY&apos;S QUESTS</SectionTitle>
        {restToday ? (
          <p className="rounded-xl border border-gold/60 bg-panel p-4 text-sm leading-normal">
            <span className="font-display font-semibold tracking-wider text-gold">REST DAY. </span>
            Recovery counts as progress: +{REST_DAY_POINTS} Endurance. No daily quests today.
          </p>
        ) : (
          dailies.map((q) => <QuestCard key={q.id} quest={q} />)
        )}
        {!restToday &&
          (canTakeRestDay(restDays, today) ? (
            <RestDayButton points={REST_DAY_POINTS} />
          ) : (
            restTaken && (
              <p className="text-xs text-muted">
                Rest day taken this week: {weekday(restTaken)}.
              </p>
            )
          ))}
      </section>

      {main && (
        <section className="flex flex-col gap-3">
          <SectionTitle aside="Due Sunday">MAIN QUEST</SectionTitle>
          <QuestCard quest={main} />
        </section>
      )}

      <section className="flex flex-col gap-3">
        <SectionTitle aside="Optional">SIDE QUESTS</SectionTitle>
        {sides.map((q) => (
          <QuestCard
            key={q.id}
            quest={q}
            note={q.source === "user" && q.status === "open" ? "Due Sunday" : undefined}
          />
        ))}
        {madeToday < USER_SIDE_QUESTS_PER_DAY ? (
          <Link
            href="/quests/new"
            className="flex min-h-11 items-center justify-center rounded-[10px] border border-dashed border-line font-display text-sm font-semibold tracking-wider text-accent"
          >
            CREATE A SIDE QUEST
          </Link>
        ) : (
          <p className="text-xs text-muted">
            You made {USER_SIDE_QUESTS_PER_DAY} side quests today. Make more tomorrow.
          </p>
        )}
      </section>

      <p className="text-xs leading-normal text-muted">
        Difficulty rank {rank}. The System adjusts it each week to keep you
        clearing about 70 to 80% of your quests.
      </p>

      {devTester && <DevPassDay />}
    </div>
  );
}

export default function QuestsPage() {
  return (
    <AppShell active="quests">
      <Suspense fallback={<p className="text-base text-muted">Loading quests</p>}>
        <Quests />
      </Suspense>
    </AppShell>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppShell } from "../app-shell";
import { DevPassDay } from "../dev/dev-panel";
import { calibrationDay } from "@/lib/game/calibration";
import {
  CALIBRATION_DAYS,
  REST_DAY_POINTS,
  USER_SIDE_QUESTS_PER_DAY,
} from "@/lib/game/constants";
import { getQuestline } from "@/lib/game/skill-questlines";
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
  const { today, restDays, weeklyRestDays, cards, rank, sick, calibration } = day;
  // A rerolled quest is replaced by its swap, so it is not shown.
  const quests = day.quests.filter((q) => q.status !== "rerolled");

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
  const placements = calibration
    ? quests
        .filter((q) => q.type === "placement" && q.issuedOn >= calibration.calibration.startedOn)
        .sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0))
    : [];
  const skills = quests.filter(
    (q) => q.type === "skill" && ((q.status === "open" && q.dueOn >= today) || clearedToday(q)),
  );
  const questlineOf = (cardId: string | null) => {
    const card = cards.find((c) => c.id === cardId);
    const questline = card?.questlineId ? getQuestline(card.questlineId) : undefined;
    return card && questline ? { card, questline } : null;
  };
  const doubleOn = cards.some((c) => c.kind === "double_xp" && c.status === "active");
  const shieldUp = cards.some((c) => c.kind === "shield" && c.status === "active");
  const cleared = quests.filter(clearedToday).length;
  const madeToday = quests.filter((q) => q.source === "user" && q.issuedOn === today).length;
  const restToday = isRestDay(restDays, today);
  const weeklyRestToday = isRestDay(weeklyRestDays, today);
  const restTaken = restDayThisWeek(weeklyRestDays, today);
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

      {(doubleOn || shieldUp) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] font-semibold text-gold">
          {doubleOn && <span>Double XP active: your next quest counts twice</span>}
          {shieldUp && <span>Shield up: the next day you miss has no penalty</span>}
        </div>
      )}

      <section className="flex flex-col gap-3">
        <SectionTitle aside={`${cleared} cleared today`}>TODAY&apos;S QUESTS</SectionTitle>
        {restToday ? (
          <p className="rounded-xl border border-gold/60 bg-panel p-4 text-sm leading-normal">
            {weeklyRestToday ? (
              <>
                <span className="font-display font-semibold tracking-wider text-gold">REST DAY. </span>
                Recovery counts as progress: +{REST_DAY_POINTS} Endurance. No daily quests today.
              </>
            ) : (
              <>
                <span className="font-display font-semibold tracking-wider text-gold">REST CARD. </span>
                Today&apos;s daily quests are rested, with no penalty.
              </>
            )}
          </p>
        ) : (
          dailies.map((q) => <QuestCard key={q.id} quest={q} />)
        )}
        {!restToday &&
          (canTakeRestDay(weeklyRestDays, today) ? (
            <RestDayButton points={REST_DAY_POINTS} />
          ) : (
            restTaken && (
              <p className="text-xs text-muted">
                Rest day taken this week: {weekday(restTaken)}.
              </p>
            )
          ))}
      </section>

      {calibration && (
        <section className="flex flex-col gap-3">
          <SectionTitle
            aside={`Day ${calibrationDay(calibration.calibration.startedOn, today)} of ${CALIBRATION_DAYS}`}
          >
            PLACEMENT QUESTS
          </SectionTitle>
          <p className="text-[13px] leading-normal text-muted">
            Your calibration week. Each placement quest tests one grade and stays open
            until day {CALIBRATION_DAYS}. Photo or summary proof counts most. Skipping
            carries no penalty.
          </p>
          {placements.map((q) => (
            <QuestCard key={q.id} quest={q} />
          ))}
        </section>
      )}

      {main && (
        <section className="flex flex-col gap-3">
          <SectionTitle aside="Due Sunday">MAIN QUEST</SectionTitle>
          <QuestCard quest={main} />
        </section>
      )}

      {skills.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionTitle aside="One step a day">SKILL QUESTLINES</SectionTitle>
          {skills.map((q) => {
            const line = questlineOf(q.cardId);
            const note = line
              ? `${line.questline.name} · step ${Math.min(line.card.questlineStep + (q.status === "open" ? 1 : 0), line.questline.steps.length)} of ${line.questline.steps.length}${q.status === "open" ? ` · open until ${weekday(q.dueOn)}` : ""}`
              : undefined;
            return <QuestCard key={q.id} quest={q} note={note} />;
          })}
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

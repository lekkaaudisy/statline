import Link from "next/link";
import type { Quest } from "@/lib/supabase/quests";
import { QuestHeader } from "./quest-view";

const DONE_LABEL: Partial<Record<Quest["status"], string>> = {
  cleared: "CLEARED",
  rested: "RESTED",
  missed: "MISSED",
  excused: "EXCUSED",
  shielded: "SHIELDED",
  rerolled: "REROLLED",
};

export function QuestCard({ quest, note }: { quest: Quest; note?: string }) {
  const done = DONE_LABEL[quest.status];
  return (
    <article className="flex flex-col gap-2.5 rounded-xl border border-[#243349] bg-panel p-4">
      <QuestHeader quest={quest} />
      {note && <p className="text-xs text-muted">{note}</p>}
      {done ? (
        <Link
          href={`/quests/${quest.id}`}
          className="flex min-h-11 items-center justify-center rounded-[10px] bg-[#18222f] font-display text-sm tracking-wider text-muted"
        >
          {done}
        </Link>
      ) : (
        <Link
          href={`/quests/${quest.id}`}
          className="flex min-h-11 items-center justify-center rounded-[10px] border border-accent bg-[#0f2230] font-display text-[15px] font-semibold tracking-wider text-foreground"
        >
          COMPLETE QUEST
        </Link>
      )}
    </article>
  );
}

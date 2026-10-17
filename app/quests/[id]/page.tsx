import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AppShell } from "../../app-shell";
import { withDoubleXp } from "@/lib/game/card-effects";
import { toIsoDate } from "@/lib/game/dates";
import { PROOF_INFO, proofPoints, type ProofType } from "@/lib/game/proof";
import { STAT_INFO } from "@/lib/game/stats";
import { currentUserId, QUEST_COLUMNS, toQuest } from "@/lib/supabase/quests";
import { createClient } from "@/lib/supabase/server";
import { PROOF_BUCKET } from "@/lib/supabase/storage";
import { QuestHeader } from "../quest-view";
import { ProofForm } from "./proof-form";

// How long a link to a proof photo works, in seconds.
const PHOTO_LINK_SECONDS = 600;

const CLOSED_TEXT = {
  missed: "This quest was missed. The System gives new quests every day.",
  rested: "Rested: this daily fell on a rest day, with no penalty.",
  excused: "Excused: missed while sick or injured, so it does not count.",
  shielded: "Shielded: a Shield card covered this day, so it carries no penalty.",
  rerolled: "Rerolled: a Reroll card swapped this quest for another.",
  expired: "This quest has ended.",
};

const PENALTY_TEXT = {
  card: "Main quest failed: it cost one held card.",
  dent: "Main quest failed: it cost a small stat dent.",
  none: null,
};

type ProofRow = {
  proof_type: ProofType;
  summary: string | null;
  photo_path: string | null;
  points_awarded: number;
};

async function QuestDetail({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { id } = await params;
  const userId = await currentUserId(supabase);
  const { data: row } = await supabase.from("quests").select(QUEST_COLUMNS).eq("id", id).maybeSingle();
  if (!row || !userId) notFound();
  const quest = toQuest(row);
  const today = toIsoDate(new Date());
  const statName = STAT_INFO[quest.stat].name;

  let body;
  if (quest.status === "cleared") {
    const { data } = await supabase
      .from("quest_proofs")
      .select("proof_type, summary, photo_path, points_awarded")
      .eq("quest_id", quest.id)
      .maybeSingle();
    const proof = data as ProofRow | null;
    const photo = proof?.photo_path
      ? (await supabase.storage.from(PROOF_BUCKET).createSignedUrl(proof.photo_path, PHOTO_LINK_SECONDS)).data?.signedUrl
      : null;
    body = (
      <section className="flex flex-col gap-3 rounded-xl border border-line bg-panel p-4">
        <p className="font-display text-sm tracking-[0.15em] text-accent">CLEARED</p>
        {proof && (
          <p className="text-sm">
            {PROOF_INFO[proof.proof_type].name} proof: +{proof.points_awarded} {statName}
          </p>
        )}
        {proof?.summary && <p className="text-sm leading-normal text-muted">{proof.summary}</p>}
        {photo && (
          // A short-lived private link, so the Next.js image optimiser is not used.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="Your proof photo" className="max-h-80 w-full rounded-lg object-contain" />
        )}
      </section>
    );
  } else if (quest.status === "open" && quest.dueOn >= today) {
    const { data: doubleCard } = await supabase
      .from("cards")
      .select("id")
      .eq("kind", "double_xp")
      .eq("status", "active")
      .maybeSingle();
    const doubleXp = Boolean(doubleCard);
    const options = (["evidence", "honour"] as const).map((p) => ({
      proof: p,
      points: withDoubleXp(proofPoints(quest.gain, p), doubleXp),
      allowed: quest.allowedProofs.includes(p),
    }));
    body = (
      <ProofForm
        questId={quest.id}
        userId={userId}
        rank={quest.rank}
        statName={statName}
        options={options}
        doubleXp={doubleXp}
      />
    );
  } else {
    const key = quest.status === "open" ? "expired" : quest.status;
    const penalty = quest.penalty ? PENALTY_TEXT[quest.penalty] : null;
    body = (
      <p className="rounded-xl border border-line p-4 text-sm text-muted">
        {CLOSED_TEXT[key]}
        {penalty && <span className="mt-2 block text-gold">{penalty}</span>}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Link href="/quests" className="flex min-h-11 items-center text-sm text-accent">
        Back to quests
      </Link>
      <article className="flex flex-col gap-2.5 rounded-xl border border-[#243349] bg-panel p-4">
        <QuestHeader quest={quest} />
      </article>
      {body}
    </div>
  );
}

export default function QuestPage(props: PageProps<"/quests/[id]">) {
  return (
    <AppShell active="quests">
      <Suspense fallback={<p className="text-base text-muted">Loading quest</p>}>
        <QuestDetail params={props.params} />
      </Suspense>
    </AppShell>
  );
}

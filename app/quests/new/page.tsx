import Link from "next/link";
import { AppShell } from "../../app-shell";
import { SideQuestForm } from "./side-quest-form";

export default function NewSideQuestPage() {
  return (
    <AppShell active="quests">
      <div className="flex flex-col gap-5">
        <Link href="/quests" className="flex min-h-11 items-center text-sm text-accent">
          Back to quests
        </Link>
        <h1 className="font-display text-sm tracking-[0.15em] text-accent">NEW SIDE QUEST</h1>
        <SideQuestForm />
      </div>
    </AppShell>
  );
}

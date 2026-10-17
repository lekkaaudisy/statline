import Link from "next/link";
import type { ReactNode } from "react";
import { logOut } from "./login/actions";

const TABS = [
  { id: "status", label: "STATUS", href: "/" },
  { id: "quests", label: "QUESTS", href: "/quests" },
  { id: "cards", label: "CARDS", href: "/cards" },
  { id: "crew", label: "CREW", href: "/crew" },
] as const;

export type Tab = (typeof TABS)[number]["id"];

// The frame around every main screen: the System header, the page, and the
// bottom tab bar from the prototype.
export function AppShell({ active, children }: { active: Tab; children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <header className="flex items-end justify-between border-b border-track px-4 pt-5 pb-3.5">
        <div className="flex flex-col gap-1">
          <span className="font-display text-xs tracking-[0.25em] text-accent">
            THE SYSTEM
          </span>
          <span className="font-display text-2xl font-bold tracking-wide">
            STATLINE
          </span>
        </div>
        <form action={logOut}>
          <button
            type="submit"
            className="min-h-11 rounded-md border border-line px-3 font-display text-sm font-medium uppercase tracking-wider text-accent"
          >
            Log out
          </button>
        </form>
      </header>
      <main className="flex-1 px-4 py-5">{children}</main>
      <nav
        aria-label="Main"
        className="sticky bottom-0 grid grid-cols-4 border-t border-track bg-[#0d121b] pb-[env(safe-area-inset-bottom)]"
      >
        {TABS.map((tab) => {
          const current = tab.id === active;
          return (
            <Link
              key={tab.id}
              href={tab.href}
              aria-current={current ? "page" : undefined}
              className={`flex min-h-[60px] items-center justify-center border-t-2 font-display text-sm font-semibold tracking-wider ${
                current ? "border-accent text-accent" : "border-transparent text-muted"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

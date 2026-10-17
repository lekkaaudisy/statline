export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <section className="w-full max-w-sm rounded-lg border border-accent/40 bg-panel p-6 shadow-[0_0_24px_rgba(94,209,240,0.12)]">
        <p className="font-display text-xs font-medium uppercase tracking-[0.3em] text-accent">
          System
        </p>
        <h1 className="mt-2 font-display text-4xl font-bold tracking-wide text-foreground">
          Statline
        </h1>
        <p className="mt-4 text-base text-muted">
          The system is being prepared. Quests will appear here soon.
        </p>
      </section>
    </main>
  );
}

import Link from "next/link";

/** Today-page row for the move-based daily set (shared by the signed-in and guest pages). */
export function MovesTodayCard({ href, done, total, minutes, canStart = true }: { href: string; done: number; total: number; minutes: number; canStart?: boolean }) {
  const complete = total > 0 && done >= total;
  const body = (
    <div className={`flex items-center gap-3 rounded-xl border p-3 ${complete ? "border-mastery/40 bg-mastery/5" : "border-line"}`}>
      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-bold ${complete ? "bg-mastery text-white" : "border-2 border-line"}`} aria-hidden>{complete ? "✓" : ""}</span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Moves: daily set{total ? ` · ${done} / ${total}` : ""}</p>
        <p className="text-xs text-muted">1 review · 1 new concept · 1 stretch. No paper needed{minutes ? ` · ${minutes} min today` : ""}</p>
      </div>
      {canStart && !complete && <span className="text-sm font-semibold text-brand">{done ? "Continue →" : "Start →"}</span>}
    </div>
  );
  return (
    <section className="card">
      <h2 className="h2">Move practice</h2>
      <div className="mt-3">{canStart ? <Link href={href}>{body}</Link> : body}</div>
      <p className="mt-2 text-xs text-muted">Counts toward today&apos;s minutes. It doesn&apos;t replace the items above.</p>
    </section>
  );
}

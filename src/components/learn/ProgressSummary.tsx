// A short, honest picture of learning: what has been met, what is being built, what is
// solid, and what needs another look. No completion percentages.
import Link from "next/link";
import { addDays } from "@/lib/dates";
import { conceptOf } from "@/lib/learn/curriculum";
import { grade, rank, type ConceptSnapshot } from "@/lib/learn/mastery";
import type { Evidence } from "@/lib/learn/state";

export function progressFacts(snaps: Map<string, ConceptSnapshot>, events: Evidence[]) {
  const all = [...snaps.values()];
  const seen = all.filter((s) => s.seen);
  const last = events[events.length - 1]?.date;
  const recentClean = last ? events.filter((e) => e.date > addDays(last, -14) && grade(e) === "clean" && e.dimension !== "comprehension") : [];
  const techniques = [...new Set(recentClean.map((e) => e.conceptId))].flatMap((id) => conceptOf(id)?.techniques.slice(0, 1) ?? []).slice(0, 4);
  const domainStrength = new Map<string, number>();
  for (const s of all) if (rank(s.state) >= rank("proficient")) {
    const d = conceptOf(s.conceptId)!.domain;
    domainStrength.set(d, (domainStrength.get(d) ?? 0) + 1);
  }
  return {
    discovered: seen.length,
    developing: seen.filter((s) => ["introduced", "developing", "practicing"].includes(s.state)),
    solid: seen.filter((s) => rank(s.state) >= rank("proficient")),
    mastered: seen.filter((s) => s.state === "mastered"),
    reinforce: seen.filter((s) => s.needsReinforcement),
    techniques,
    domainStrength,
  };
}

export function ProgressSummary({ snaps, events, mapHref }: { snaps: Map<string, ConceptSnapshot>; events: Evidence[]; mapHref: string }) {
  const f = progressFacts(snaps, events);
  if (!f.discovered) return null;
  const stat = (n: number, label: string) => (
    <div className="rounded-2xl bg-white px-3 py-3 text-center ring-1 ring-line">
      <p className="text-2xl font-bold">{n}</p>
      <p className="text-xs font-medium text-muted">{label}</p>
    </div>
  );
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="text-lg font-bold">Where you are</h2>
        <Link href={mapHref} className="text-sm font-semibold text-brand">Full map →</Link>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {stat(f.discovered, "ideas met")}
        {stat(f.developing.length, "being built")}
        {stat(f.solid.length, "solid")}
      </div>
      {f.reinforce.length > 0 && (
        <p className="rounded-2xl border border-reinforce/30 bg-reinforce/5 px-4 py-3 text-sm">
          <span className="font-semibold text-reinforce">Needs another look: </span>
          {f.reinforce.map((s) => conceptOf(s.conceptId)?.name).join(", ")}. These come first in the next few days.
        </p>
      )}
      {f.techniques.length > 0 && (
        <p className="px-1 text-sm text-muted"><span className="font-semibold text-ink">Recently used on your own: </span>{f.techniques.join(" · ")}</p>
      )}
    </section>
  );
}

"use client";
// The Progress page: a short, honest picture of learning: what has been met, what is being built, what is
// solid, and what needs another look. No completion percentages.
import { useMemo } from "react";
import Link from "next/link";
import { addDays } from "@/lib/dates";
import { COURSE, conceptOf } from "@/lib/learn/curriculum";
import { grade, rank, snapshots, type ConceptSnapshot } from "@/lib/learn/mastery";
import { recentDays } from "@/lib/learn/problems";
import { PageHero } from "@/components/ui/PageHero";
import { IconProgress } from "@/components/ui/icons";
import type { LearnStore } from "./useLearnStore";
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

const DOM = ["#7c3aed", "#047857", "#c2410c", "#0369a1"];

export function ProgressView({ store, today, base }: { store: LearnStore; today: string; base: string }) {
  const { state } = store;
  const snaps = useMemo(() => snapshots(state.events), [state.events]);
  const f = useMemo(() => progressFacts(snaps, state.events), [snaps, state.events]);
  const week = useMemo(() => recentDays(state, today, 14), [state, today]);
  const solvedDays = week.filter((d) => d.done).length;
  const domains = COURSE.domains.map((d, k) => {
    const ids = d.units.flatMap((u) => u.concepts.map((c) => c.id));
    const met = ids.filter((id) => snaps.get(id)?.seen).length;
    const solid = ids.filter((id) => { const s = snaps.get(id); return s && rank(s.state) >= rank("proficient"); }).length;
    return { id: d.id, name: d.name, total: ids.length, met, solid, color: DOM[k % DOM.length] };
  });

  return (
    <div className="space-y-5 md:space-y-6">
      <PageHero eyebrow="Progress" title="Where you are" from="#0369a1" to="#0e8c6e" icon={<IconProgress className="h-8 w-8" />}
        back={{ href: base || "/", label: "Home" }}
        subtitle="An honest picture: progress counts when an idea is used on your own, so it moves a little at a time.">
        <div className="grid grid-cols-3 gap-2">
          {[[f.discovered, "ideas met"], [f.developing.length, "being built"], [f.solid.length, "solid"]].map(([n, l]) => (
            <div key={l} className="rounded-2xl bg-white/15 px-3 py-3 text-center backdrop-blur">
              <p className="text-2xl font-black">{n}</p>
              <p className="text-xs font-semibold text-white/85">{l}</p>
            </div>
          ))}
        </div>
      </PageHero>

      {!f.discovered && (
        <p className="learn-card text-muted">Nothing here yet. Do today&apos;s three cards and your first ideas will appear.</p>
      )}

      <section className="space-y-3">
        <h2 className="px-1 text-lg font-bold">By topic</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {domains.map((d) => (
            <li key={d.id} className="learn-card card-in !p-4" style={{ ["--dom" as string]: d.color }}>
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-bold" style={{ color: d.color }}>{d.name}</p>
                <p className="text-xs font-semibold text-muted">{d.met} met · {d.solid} solid</p>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-line" role="img" aria-label={`${d.met} of ${d.total} ideas met, ${d.solid} solid`}>
                <div className="relative h-full rounded-full opacity-35" style={{ width: `${(d.met / Math.max(1, d.total)) * 100}%`, background: d.color }}>
                  <div className="absolute inset-y-0 left-0 rounded-full opacity-100" style={{ width: `${d.met ? (d.solid / d.met) * 100 : 0}%`, background: d.color }} />
                </div>
              </div>
              <p className="mt-2 text-xs text-muted">{d.total} ideas in this topic</p>
            </li>
          ))}
        </ul>
      </section>

      {f.reinforce.length > 0 && (
        <section className="learn-card card-in" data-role="reinforce">
          <h2 className="text-lg font-bold">Needs another look</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {f.reinforce.map((s) => <li key={s.conceptId} className="rounded-full bg-sun/15 px-3 py-1 text-sm font-semibold text-[#9a6700]">{conceptOf(s.conceptId)?.name}</li>)}
          </ul>
          <p className="mt-2 text-sm text-muted">These come first in the next few days.</p>
        </section>
      )}

      {f.techniques.length > 0 && (
        <section className="learn-card card-in">
          <h2 className="text-lg font-bold">Recently used on your own</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {f.techniques.map((t) => <li key={t} className="rounded-full bg-apply/10 px-3 py-1 text-sm font-semibold text-apply">{t}</li>)}
          </ul>
        </section>
      )}

      <section className="learn-card card-in">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold">Daily Problem, last 14 days</h2>
          <p className="text-sm font-semibold text-muted">{solvedDays} finished</p>
        </div>
        <div className="mt-3 grid grid-cols-7 gap-1.5">
          {week.map((d) => (
            <span key={d.date} title={`${d.date}: ${d.outcome ?? "no problem"}`}
              className={`flex h-9 items-center justify-center rounded-lg text-[11px] font-bold ${d.outcome === "clean" ? "bg-apply text-white" : d.outcome === "solved" ? "bg-violet text-white" : d.outcome === "shown" ? "bg-sun text-white" : "bg-canvas text-muted ring-1 ring-line"} ${d.date === today ? "ring-2 !ring-ink/60" : ""}`}>
              {Number(d.date.slice(8))}
            </span>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">Green: clean solve · Purple: solved · Gold: shown the answer.</p>
        <Link href={`${base}/problem`} className="btn-ghost mt-3">Go to today&apos;s problem</Link>
      </section>

      <p className="px-1 text-sm text-muted">Want every idea in detail? <Link href={`${base}/map`} className="font-semibold text-brand">Open the map →</Link></p>
    </div>
  );
}

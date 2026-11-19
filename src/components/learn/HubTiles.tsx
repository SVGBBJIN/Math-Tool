"use client";
// The home screen's doorways: one big, colorful tile per feature, each showing a live
// one-line status so there is a reason to open it.
import { useMemo } from "react";
import Link from "next/link";
import { DOMAIN_NAME, getProblem, problemDayOf } from "@/lib/learn/problems";
import { snapshots } from "@/lib/learn/mastery";
import { IconArrow, IconCheck, IconProblem, IconProgress } from "@/components/ui/icons";
import { progressFacts } from "./ProgressView";
import type { LearnStore } from "./useLearnStore";

const DOM_COLOR = { alg: ["#7c3aed", "#c026d3"], nt: ["#047857", "#0e7490"], cp: ["#c2410c", "#be185d"], geo: ["#0369a1", "#6d28d9"] } as const;

function Tile({ href, from, to, icon, eyebrow, title, line, done }: {
  href: string; from: string; to: string; icon: React.ReactNode; eyebrow: string; title: string; line: string; done?: boolean;
}) {
  return (
    <Link href={href} className="tile group card-in" style={{ ["--h1" as string]: from, ["--h2" as string]: to }}>
      <span className="hero-orb hero-orb-a" aria-hidden />
      <div className="relative flex h-full flex-col">
        <div className="flex items-center justify-between">
          <span className="tile-icon" aria-hidden>{icon}</span>
          {done && <span className="flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide" style={{ color: from }}><IconCheck className="h-3.5 w-3.5" />Done</span>}
        </div>
        <p className="mt-4 text-xs font-bold uppercase tracking-[0.16em] text-white/75">{eyebrow}</p>
        <h2 className="text-xl font-black leading-tight tracking-tight">{title}</h2>
        <p className="mt-1 flex-1 text-sm text-white/85">{line}</p>
        <span className="mt-3 inline-flex items-center gap-1 text-sm font-bold">Open <IconArrow className="h-4 w-4 transition group-hover:translate-x-1" /></span>
      </div>
    </Link>
  );
}

export function HubTiles({ store, today, base }: { store: LearnStore; today: string; base: string }) {
  const { state } = store;
  const day = problemDayOf(state, today);
  const p = day ? getProblem(day.problemId) : null;
  const facts = useMemo(() => progressFacts(snapshots(state.events), state.events), [state.events]);
  const [pa, pb] = p ? DOM_COLOR[p.domain] : ["#7c3aed", "#c026d3"];
  return (
    <section aria-label="Explore" className="grid gap-3 sm:grid-cols-2">
      <Tile href={`${base}/problem`} from={pa} to={pb} icon={<IconProblem className="h-6 w-6" />} eyebrow="Daily Problem"
        title={p ? p.title : "Today's problem"} done={!!day?.done}
        line={day?.done ? "Solved for today. See how you did." : p ? `${DOMAIN_NAME[p.domain]} · solve it one step at a time.` : "A new problem every day, one step at a time."} />
      <Tile href={`${base}/progress`} from="#0369a1" to="#0e8c6e" icon={<IconProgress className="h-6 w-6" />} eyebrow="Progress"
        title="Where you are"
        line={facts.discovered ? `${facts.discovered} ideas met · ${facts.solid.length} solid${facts.reinforce.length ? ` · ${facts.reinforce.length} to revisit` : ""}` : "Your first ideas will show up here."} />
    </section>
  );
}

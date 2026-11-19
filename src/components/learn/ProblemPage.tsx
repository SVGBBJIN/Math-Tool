"use client";
// The Daily Problem on its own page: just the problem, with room to think.
import { PageHero } from "@/components/ui/PageHero";
import { IconProblem } from "@/components/ui/icons";
import { DailyProblemView } from "./DailyProblemView";
import type { LearnStore } from "./useLearnStore";

export function ProblemPage({ store, today, base }: { store: LearnStore; today: string; base: string }) {
  return (
    <div className="space-y-5 md:space-y-6">
      <PageHero eyebrow="Daily Problem" title="Think it through" from="#7c3aed" to="#c026d3" icon={<IconProblem className="h-8 w-8" />}
        back={{ href: base || "/", label: "Home" }}
        subtitle="One problem a day, solved one small step at a time. Hints are free." />
      <DailyProblemView store={store} today={today} />
    </div>
  );
}

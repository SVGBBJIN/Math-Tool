// Small shared pieces of the learning UI.
import type { CardType } from "@/lib/learn/cards/types";
import { STATE_LABEL, type MasteryState } from "@/lib/learn/mastery";
import type { Slot } from "@/lib/learn/state";

const ROLE: Record<Slot, { label: string; cls: string }> = {
  discover: { label: "Discover", cls: "bg-brand/12 text-brand" },
  reinforce: { label: "Reinforce", cls: "bg-sun/18 text-[#9a6700]" },
  apply: { label: "Apply", cls: "bg-mastery/15 text-apply" },
  extra: { label: "One more", cls: "bg-violet/12 text-violet" },
  explore: { label: "Practice", cls: "bg-pink/10 text-pink" },
};
const TYPE_LABEL: Record<CardType, string> = { insight: "Insight", technique: "Technique", recognition: "Recognise", application: "Apply it", variation: "Variation" };

export function RoleChip({ slot, type }: { slot: Slot; type?: CardType }) {
  const r = ROLE[slot];
  return (
    <span className={`role-chip ${r.cls}`}>
      {r.label}{type ? <span className="font-semibold normal-case tracking-normal opacity-80">· {TYPE_LABEL[type]}</span> : null}
    </span>
  );
}

export const STATE_STYLE: Record<MasteryState, { dot: string; text: string }> = {
  locked: { dot: "bg-line", text: "text-muted" },
  available: { dot: "border-2 border-line bg-white", text: "text-muted" },
  introduced: { dot: "bg-proficient/40", text: "text-ink" },
  developing: { dot: "bg-proficient", text: "text-discover" },
  practicing: { dot: "bg-discover", text: "text-discover" },
  proficient: { dot: "bg-mastery/70", text: "text-apply" },
  mastered: { dot: "bg-apply", text: "text-apply" },
};

export function StateBadge({ state }: { state: MasteryState }) {
  const s = STATE_STYLE[state];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${s.text}`}>
      <span className={`h-2.5 w-2.5 rounded-full ${s.dot}`} aria-hidden />{STATE_LABEL[state]}
    </span>
  );
}

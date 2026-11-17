// Glue between a finished card and the learning record, shared by the Today feed and the map.
import { conceptOf } from "@/lib/learn/curriculum";
import { STATE_LABEL } from "@/lib/learn/mastery";
import { recordResult, setMissDetails, type CardResult } from "@/lib/learn/record";
import type { LearnStore } from "./useLearnStore";

export function recordCard(store: LearnStore, r: CardResult, today: string) {
  let out: ReturnType<typeof recordResult> | null = null;
  store.update((s) => (out = recordResult(s, r, today)).state);
  const rec = out as ReturnType<typeof recordResult> | null;
  const messages = (rec?.changes ?? []).map((c) => {
    const name = conceptOf(c.conceptId)?.name ?? c.conceptId;
    if (c.from === "locked") return `Unlocked: ${name}.`;
    if (c.to === "mastered") return `${name}: mastered. It has held up over time.`;
    const up = ["introduced", "developing", "practicing", "proficient"].indexOf(c.to) > ["available", "introduced", "developing", "practicing"].indexOf(c.from);
    return up ? `${name}: now ${STATE_LABEL[c.to]}.` : `${name}: back to ${STATE_LABEL[c.to]} for now. It will come round again soon.`;
  });
  return { missId: rec?.missId ?? null, messages };
}

export const tagMiss = (store: LearnStore, id: string, errorType: string) => store.update((s) => setMissDetails(s, id, errorType, ""));

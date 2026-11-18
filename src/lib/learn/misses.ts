// Bridges misses from the learning cards into the app's error log (the Errors tab and its
// review), so they sit next to older trainer misses.
import type { MissRow } from "@/app/(app)/errors/ReviewClient";
import { getCard } from "./cards";
import { conceptOf } from "./curriculum";
import type { LearnState } from "./state";

export const LEARN_MISS_PREFIX = "learn:";
/** Ids from the earlier move-based engine, still accepted so old links keep working. */
export const LEGACY_MISS_PREFIX = "eng:";

export function learnMissRows(s: LearnState): MissRow[] {
  return s.misses.map((m) => {
    const card = getCard(m.cardId);
    return {
      id: LEARN_MISS_PREFIX + m.id,
      date: m.date,
      yourAnswer: m.outcome === "skipped" ? "skipped" : m.userAnswer || "blank",
      correctAnswer: m.correctAnswer,
      errorType: m.errorType ?? "",
      keyIdea: m.note || card?.takeaway || "",
      familiar: false,
      title: m.problem.length > 90 ? m.problem.slice(0, 90) + "…" : m.problem,
      link: null,
      tags: [conceptOf(m.conceptId)?.name ?? "Earlier practice"],
      takeaway: m.takeaway,
    };
  });
}

export const missIdOf = (rowId: string) => (rowId.startsWith(LEARN_MISS_PREFIX) ? rowId.slice(LEARN_MISS_PREFIX.length) : null);

export function learnReviewCounts(s: LearnState, today: string) {
  return { reviewedToday: s.misses.filter((m) => m.reviewedOn === today).length, remaining: s.misses.filter((m) => !m.takeaway).length };
}

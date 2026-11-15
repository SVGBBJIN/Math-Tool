// Bridges the engine's mistake records into the app's existing error log (the Errors tab
// and the Wednesday review), so misses from move-based cards sit next to trainer misses.
import type { MissRow } from "@/app/(app)/errors/ReviewClient";
import { getCard, skillOf } from "./registry";
import type { EngineProgress } from "./progress";

export const ENGINE_MISS_PREFIX = "eng:";

export function engineMissRows(p: EngineProgress): MissRow[] {
  return p.mistakes.map((m) => ({
    id: ENGINE_MISS_PREFIX + m.id,
    date: m.date,
    yourAnswer:
      (m.outcome === "not_sure" ? `not sure (reached ${m.userAnswer})` : m.outcome === "timeout" ? `ran out of time at ${m.userAnswer}` : m.userAnswer) +
      (m.failedStep ? ` · stopped at ${m.failedStep}` : ""),
    correctAnswer: m.correctAnswer,
    errorType: m.errorType ?? "",
    keyIdea: m.note || getCard(m.cardId)?.insight || "",
    familiar: false,
    title: m.problem.length > 90 ? m.problem.slice(0, 90) + "…" : m.problem,
    link: null,
    tags: ["moves", skillOf(m.skill)?.title ?? m.skill],
    takeaway: m.takeaway,
    seconds: m.seconds,
  }));
}

/** Engine misses reviewed on a date / still waiting, for the error-review day's completion rule. */
export function engineReviewCounts(p: EngineProgress, today: string) {
  return { reviewedToday: p.mistakes.filter((m) => m.reviewedOn === today).length, remaining: p.mistakes.filter((m) => !m.takeaway).length };
}

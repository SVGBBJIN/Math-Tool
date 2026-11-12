// Spaced review of missed techniques via "twin" problems (pure functions).
//
// A miss creates (or resets) a pending review item for the problem's primary technique tag,
// due in 1 day. When a twin (new problem, same tag) is solved correctly and cold
// (not familiar), the item advances: due again in 3, then 7, then 21 days; a correct
// cold solve at the 21-day stage retires it. Any miss resets it to the 1-day stage.
// Familiar attempts do not move the item (they are not evidence either way).
import { addDays } from "./dates";

export const REVIEW_INTERVALS = [1, 3, 7, 21] as const;

export interface ReviewItemState {
  stage: number; // index into REVIEW_INTERVALS
  dueDate: string;
  status: "pending" | "retired";
}

export interface AttemptOutcome {
  correct: boolean;
  familiar: boolean;
}

/** Transition for an attempt made AS a twin for this review item. */
export function applyTwinOutcome(
  item: ReviewItemState,
  outcome: AttemptOutcome,
  today: string,
): ReviewItemState {
  if (item.status !== "pending") return item;
  if (outcome.familiar) return item; // not a cold solve: no change, still due
  if (!outcome.correct) {
    return { stage: 0, dueDate: addDays(today, REVIEW_INTERVALS[0]), status: "pending" };
  }
  const next = item.stage + 1;
  if (next >= REVIEW_INTERVALS.length) {
    return { ...item, status: "retired" };
  }
  return { stage: next, dueDate: addDays(today, REVIEW_INTERVALS[next]), status: "pending" };
}

/**
 * Transition for a miss on a non-twin problem: create a pending item for the tag,
 * or reset the existing pending one.
 */
export function applyMiss(existing: ReviewItemState | null, today: string): ReviewItemState {
  void existing; // either way the result is a fresh stage-0 item
  return { stage: 0, dueDate: addDays(today, REVIEW_INTERVALS[0]), status: "pending" };
}

export function primaryTechnique(techniqueTags: string[]): string | null {
  return techniqueTags[0] ?? null;
}

export function isDue(item: ReviewItemState, today: string): boolean {
  return item.status === "pending" && item.dueDate <= today;
}

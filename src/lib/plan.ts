// Daily plan, completion and streak rules (pure functions).
import { addDays, weekday } from "./dates";

export type PlanItem = "trainer" | "error_review" | "timed_block" | "saturday_review" | "khan" | "scroll";

export const PLAN_LABELS: Record<PlanItem, string> = {
  trainer: "Trainer: 3 problems (~25 min)",
  error_review: "Error-log review",
  timed_block: "Timed block",
  saturday_review: "Review Saturday's block",
  khan: "Khan Academy precalculus",
  scroll: "Math scroll (optional)",
};

/** Minutes of any plan item that keep the streak alive on an otherwise incomplete day. */
export const MINIMUM_DAY_MINUTES = 10;

/** Reviews needed to complete Wednesday's error-log review (or all remaining, if fewer). */
export const ERROR_REVIEW_TARGET = 5;

export interface PlanOptions {
  /** Whether a Khan Academy session is required on this date (configurable per date range). */
  khanRequired: boolean;
}

export function requiredItems(date: string, opts: PlanOptions): PlanItem[] {
  const items: PlanItem[] = [];
  switch (weekday(date)) {
    case 1: // Mon
    case 2: // Tue
    case 4: // Thu
    case 5: // Fri
      items.push("trainer");
      break;
    case 3: // Wed
      items.push("error_review");
      break;
    case 6: // Sat
      items.push("timed_block");
      break;
    case 0: // Sun
      items.push("saturday_review");
      break;
  }
  if (opts.khanRequired) items.push("khan");
  return items;
}

export interface ActivityRow {
  item: PlanItem;
  minutes: number;
  completed: boolean;
}

export interface DayStatus {
  required: PlanItem[];
  done: PlanItem[];
  remaining: PlanItem[];
  totalMinutes: number;
  /** Every required item completed. Nagging stops only when this is true. */
  complete: boolean;
  /** Complete, or at least MINIMUM_DAY_MINUTES of plan work: keeps the streak. */
  minimumMet: boolean;
}

export function evaluateDay(required: PlanItem[], activity: ActivityRow[]): DayStatus {
  const doneSet = new Set(activity.filter((a) => a.completed).map((a) => a.item));
  const done = required.filter((i) => doneSet.has(i));
  const remaining = required.filter((i) => !doneSet.has(i));
  // Only minutes spent on plan items count (all PlanItem rows are plan items).
  const totalMinutes = activity.reduce((s, a) => s + Math.max(0, a.minutes), 0);
  const complete = remaining.length === 0;
  return {
    required,
    done,
    remaining,
    totalMinutes,
    complete,
    minimumMet: complete || totalMinutes >= MINIMUM_DAY_MINUTES,
  };
}

/**
 * Current streak in days. Today counts if it is already kept; an unfinished today
 * does not break the streak (the day is still in progress).
 * `kept` maps local date -> whether the minimum was met that day.
 */
export function currentStreak(kept: Map<string, boolean>, today: string): number {
  let streak = 0;
  let day = kept.get(today) ? today : addDays(today, -1);
  while (kept.get(day)) {
    streak++;
    day = addDays(day, -1);
  }
  return streak;
}

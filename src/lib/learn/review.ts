// Review engine: when each concept should come back.
//
// Scheduling is per CONCEPT, not per card: a review asks for the idea again on a problem
// the student has not just seen. The schedule is folded from the evidence log:
//
//   first contact            → due the next day
//   clean success, spaced    → move one step up the ladder (1, 3, 7, 16, 35, 75 days)
//   clean success, too soon  → nothing changes: cramming does not buy a longer interval
//   right, but with help     → same step again
//   miss                     → drop two steps, due tomorrow
import { addDays, daysBetween } from "../dates";
import { grade } from "./mastery";
import type { Evidence } from "./state";

export const LADDER = [1, 3, 7, 16, 35, 75] as const;

export interface Schedule {
  /** Index into LADDER. */
  step: number;
  due: string;
  /** Times the concept was missed after it had been scheduled. */
  lapses: number;
  lastPractised: string;
}

/** "Spaced" means at least half of the current interval has passed since the concept was scheduled. */
interface Working extends Schedule { lastScheduled: string }
const spaced = (s: Working, date: string) => daysBetween(s.lastScheduled, date) * 2 >= LADDER[s.step];

export function scheduleOf(events: Evidence[]): Schedule | null {
  let s: Working | null = null;
  for (const e of events) {
    if (e.legacy) {
      s ??= { step: 0, due: addDays(e.date, LADDER[0]), lapses: 0, lastPractised: e.date, lastScheduled: e.date };
      continue;
    }
    if (!s) {
      s = { step: 0, due: addDays(e.date, LADDER[0]), lapses: 0, lastPractised: e.date, lastScheduled: e.date };
      continue;
    }
    const g = grade(e);
    if (g === "miss") {
      s = { ...s, step: Math.max(0, s.step - 2), due: addDays(e.date, 1), lapses: s.lapses + 1, lastPractised: e.date, lastScheduled: e.date };
    } else if (g === "clean" && spaced(s, e.date)) {
      const step = Math.min(LADDER.length - 1, s.step + 1);
      s = { ...s, step, due: addDays(e.date, LADDER[step]), lastPractised: e.date, lastScheduled: e.date };
    } else if (g === "assisted" && e.date >= s.due) {
      s = { ...s, due: addDays(e.date, LADDER[s.step]), lastPractised: e.date, lastScheduled: e.date };
    } else {
      s = { ...s, lastPractised: e.date };
    }
  }
  if (!s) return null;
  const { step, due, lapses, lastPractised } = s;
  return { step, due, lapses, lastPractised };
}

export const isDue = (s: Schedule | null, today: string) => !!s && s.due <= today;
export const overdueDays = (s: Schedule, today: string) => Math.max(0, daysBetween(s.due, today));

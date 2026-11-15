// Tunable settings for the move-based practice engine. Per-card logs (topic, skill,
// level, time, wrong moves, hints, result) exist so these can be tuned from real use.
import { daysBetween } from "../dates";

/**
 * >>> PLACEHOLDER — SET THE CONTEST DATE <<<
 * Fallback contest date (YYYY-MM-DD). The date entered in Settings always wins; this is
 * only used when Settings has none. Set NEXT_PUBLIC_CONTEST_DATE, or leave it empty.
 * Nothing in the engine hardcodes a date: pacing and the difficulty ramp come from here.
 */
export const CONTEST_DATE: string | null = process.env.NEXT_PUBLIC_CONTEST_DATE || null;

/**
 * Seconds for the timed decision step, per card type. A card's own `timeLimit` overrides it.
 * Only micro-session cards are timed (see TIMED_SOURCES), and only until the decision step
 * (the card's key move, or its first step) locks in. The follow-through and the reveal are untimed.
 */
export const TIME_BUDGETS: Record<"rep" | "twist", number> = { rep: 30, twist: 60 };
/** Micro-session sources: quick reps and the daily set. Lessons (walkthroughs) are untimed. */
export const TIMED_SOURCES: readonly string[] = ["quick", "review", "new", "stretch"];
export const isTimed = (source: string) => TIMED_SOURCES.includes(source);

/** Support level moves up after this many clean steps in a row (no wrong move, no hint)... */
export const LEVEL_UP_CLEAN_STEPS = 3;
/** ...and down after this many rejected moves in a row. */
export const LEVEL_DOWN_ERRORS = 2;
export const MAX_STEP_LOGS = 8000;

/** More rejected moves than this and a solved card earns no mastery credit. */
export const MAX_WRONG_MOVES_FOR_CREDIT = 2;
/** Wheel-spinning escape: after this many misses in a row on a skill, re-show the example and park it. */
export const WHEEL_SPIN_FAILURES = 3;
export const PARK_DAYS = 2;
/** A missed idea comes back as a fresh variant after 1, 3 and 7 days. */
export const RESURFACE_DAYS = [1, 3, 7] as const;
export const QUICK_CARDS = 3;
export const MAX_LOGS = 3000;
/** One card can add at most this many minutes to the day (a phone left on the table). */
export const MAX_MINUTES_PER_CARD = 5;

export type Phase = "foundation" | "build" | "sharpen" | "taper";
export interface Pacing {
  daysLeft: number | null;
  phase: Phase;
  /** Scaffolding never drops below this once a skill has been introduced. */
  minLevel: 1 | 2;
  /** Whether brand-new skills are still being introduced. */
  allowNew: boolean;
  /** Multiplier on time budgets (tighter as the contest approaches). */
  budgetScale: number;
}

/** Pacing and difficulty ramp from the contest date. No date (or a past one) means the gentlest phase. */
export function pacing(today: string, contestDate: string | null): Pacing {
  const daysLeft = contestDate ? daysBetween(today, contestDate) : null;
  if (daysLeft === null || daysLeft < 0 || daysLeft > 56) return { daysLeft, phase: "foundation", minLevel: 1, allowNew: true, budgetScale: 1 };
  if (daysLeft > 21) return { daysLeft, phase: "build", minLevel: 2, allowNew: true, budgetScale: 1 };
  if (daysLeft > 7) return { daysLeft, phase: "sharpen", minLevel: 2, allowNew: true, budgetScale: 0.85 };
  return { daysLeft, phase: "taper", minLevel: 2, allowNew: false, budgetScale: 1 };
}

export function timeBudget(card: { type: string; timeLimit?: number }, p: Pacing): number {
  const base = card.timeLimit ?? TIME_BUDGETS[card.type === "twist" ? "twist" : "rep"];
  return Math.max(15, Math.round(base * p.budgetScale));
}

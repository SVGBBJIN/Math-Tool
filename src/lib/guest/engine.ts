// Guest mode: the problem bank, error log and settings over a plain JSON state kept in the
// browser. Functions mutate the draft state they are given; the provider clones before
// calling and persists afterwards. No I/O here, so it is unit-testable.
// The learning record (cards, mastery, review) is stored separately by src/lib/learn.
import demoProblems from "../../../scripts/demo/problems.json";
import { localDate } from "../dates";
import { ERROR_REVIEW_TARGET, type PlanItem } from "../plan";
import type { ProblemInput, ProblemStatus } from "../problem-input";

export const GUEST_STATE_VERSION = 1;

export interface GuestSettings {
  timezone: string;
  amcDate: string;
  finalsStart: string;
  finalsEnd: string;
}

export interface GuestProblem extends ProblemInput {
  id: string;
  created_at: string;
}

export interface GuestAttempt {
  id: string;
  problem_id: string;
  session_id: string;
  review_item_id: string | null;
  local_date: string;
  seconds: number;
  answer: string | null; // null = blank
  correct: boolean;
  confidence: number;
  familiar: boolean;
  key_idea: string | null;
  error_type: string | null;
  finalized: boolean;
  created_at: string;
}

export interface GuestSession {
  id: string;
  local_date: string;
  problem_ids: string[];
  slot_reasons: string[];
  review_item_ids: (string | null)[];
  completed_at: string | null;
}

export interface GuestReviewItem {
  id: string;
  technique_tag: string;
  origin_problem_id: string | null;
  stage: number;
  due_date: string;
  status: "pending" | "retired";
}

export interface GuestErrorReview {
  attempt_id: string;
  takeaway: string;
  local_date: string;
}

export interface GuestActivity {
  local_date: string;
  item: PlanItem;
  minutes: number;
  completed: boolean;
}

export interface GuestState {
  v: typeof GUEST_STATE_VERSION;
  settings: GuestSettings;
  problems: GuestProblem[];
  sessions: GuestSession[];
  attempts: GuestAttempt[];
  reviewItems: GuestReviewItem[];
  errorReviews: GuestErrorReview[];
  activity: GuestActivity[];
  /**
   * Progress of the earlier move-based engine. No longer written; kept so older saves and
   * backups still load, and imported once into the learning record (src/lib/learn/legacy.ts).
   */
  engine?: unknown;
}

export function uid(): string {
  // crypto.randomUUID needs a secure context; the app may be opened over plain http on a LAN.
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** The 20 original practice problems (same set as `npm run seed:demo`). */
export function sampleProblems(now = new Date().toISOString()): GuestProblem[] {
  return demoProblems.map((p) => ({
    id: uid(),
    created_at: now,
    source: "pasted",
    contest: "Sample (original practice)",
    year: null,
    number: null,
    url: null,
    solution_url: null,
    statement: p.statement,
    choices: p.choices,
    answer: p.answer as GuestProblem["answer"],
    difficulty: p.difficulty,
    topic_tags: p.topics,
    technique_tags: p.techniques,
    status: "train",
  }));
}

export function emptyState(timezone: string): GuestState {
  return {
    v: GUEST_STATE_VERSION,
    settings: { timezone, amcDate: "", finalsStart: "", finalsEnd: "" },
    problems: sampleProblems(),
    sessions: [],
    attempts: [],
    reviewItems: [],
    errorReviews: [],
    activity: [],
  };
}

export function todayOf(s: GuestState): string {
  try {
    return localDate(s.settings.timezone);
  } catch {
    return localDate("UTC");
  }
}

function upsertActivity(s: GuestState, date: string, item: PlanItem, minutes: number, completed: boolean) {
  const row = s.activity.find((a) => a.local_date === date && a.item === item);
  if (row) {
    row.minutes = minutes;
    row.completed = completed;
  } else s.activity.push({ local_date: date, item, minutes, completed });
}

// ---------- error log ----------

function pendingMisses(s: GuestState) {
  const reviewed = new Set(s.errorReviews.map((r) => r.attempt_id));
  return s.attempts.filter((a) => !a.correct && a.finalized && !reviewed.has(a.id));
}

/** Misses from the learning cards, as counts the review needs (they are stored in the learning record). */
export interface LearnMissCounts { reviewedToday: number; remaining: number }
const NO_LEARN: LearnMissCounts = { reviewedToday: 0, remaining: 0 };

/** Review a trainer miss. Learning-card misses are reviewed in the learning record, then logged with `logReview`. */
export function reviewError(s: GuestState, input: { attemptId: string; takeaway: string; minutes: number }, today: string, learn: LearnMissCounts = NO_LEARN): { error?: string } {
  const takeaway = input.takeaway.trim();
  if (takeaway.length < 5) return { error: "Write what you'll do differently" };
  if (takeaway.length > 500) return { error: "Keep it under 500 characters" };
  if (s.errorReviews.some((r) => r.attempt_id === input.attemptId)) return { error: "Already reviewed" };
  if (!s.attempts.some((a) => a.id === input.attemptId)) return { error: "Attempt not found" };
  s.errorReviews.push({ attempt_id: input.attemptId, takeaway, local_date: today });
  logReview(s, today, input.minutes, learn);
  return {};
}

/** Update today's error-review activity: done after the target number of reviews, or when nothing is left. */
export function logReview(s: GuestState, today: string, minutes: number, learn: LearnMissCounts = NO_LEARN) {
  const reviewedToday = s.errorReviews.filter((r) => r.local_date === today).length + learn.reviewedToday;
  const remaining = pendingMisses(s).length + learn.remaining;
  const done = reviewedToday >= ERROR_REVIEW_TARGET || (reviewedToday > 0 && remaining === 0);
  const current = s.activity.find((a) => a.local_date === today && a.item === "error_review")?.minutes ?? 0;
  upsertActivity(s, today, "error_review", Math.round((current + Math.max(0, Math.min(30, minutes))) * 10) / 10, done);
}

/** When the error log is empty there is nothing to review; mark it done. */
export function markNothingToReview(s: GuestState, today: string, learn: LearnMissCounts = NO_LEARN): { error?: string } {
  if (pendingMisses(s).length || learn.remaining) return { error: "There are still misses to review" };
  upsertActivity(s, today, "error_review", 0, true);
  return {};
}

// ---------- problem bank ----------

/** Adds problems, skipping AoPS duplicates (same contest/year/number). Returns how many were added. */
export function addProblems(s: GuestState, inputs: ProblemInput[]): { added: number; skipped: number } {
  let added = 0;
  let skipped = 0;
  for (const p of inputs) {
    const dup =
      p.source === "aops_wiki" &&
      s.problems.some((x) => x.source === "aops_wiki" && x.contest === p.contest && x.year === p.year && x.number === p.number);
    if (dup) {
      skipped++;
      continue;
    }
    s.problems.push({ ...p, id: uid(), created_at: new Date().toISOString() });
    added++;
  }
  return { added, skipped };
}

/** Guest is a single user with full permissions, so vault sealing/unsealing is allowed. */
export function setProblemStatus(s: GuestState, id: string, status: ProblemStatus): { error?: string } {
  const p = s.problems.find((x) => x.id === id);
  if (!p) return { error: "Problem not found" };
  p.status = status;
  return {};
}

export function deleteProblem(s: GuestState, id: string): { error?: string } {
  if (!s.problems.some((p) => p.id === id)) return { error: "Problem not found" };
  const gone = new Set(s.attempts.filter((a) => a.problem_id === id).map((a) => a.id));
  s.problems = s.problems.filter((p) => p.id !== id);
  s.attempts = s.attempts.filter((a) => a.problem_id !== id);
  s.errorReviews = s.errorReviews.filter((r) => !gone.has(r.attempt_id));
  for (const r of s.reviewItems) if (r.origin_problem_id === id) r.origin_problem_id = null;
  return {};
}

// ---------- settings ----------

export function updateSettings(s: GuestState, next: GuestSettings): { error?: string } {
  const date = /^\d{4}-\d{2}-\d{2}$/;
  for (const d of [next.amcDate, next.finalsStart, next.finalsEnd]) if (d && !date.test(d)) return { error: "Check the dates" };
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: next.timezone });
  } catch {
    return { error: "Unknown time zone" };
  }
  if (next.finalsStart && next.finalsEnd && next.finalsEnd < next.finalsStart) return { error: "Finals end is before finals start" };
  s.settings = { ...next };
  return {};
}

/** Light shape check for a restored backup; rejects anything that isn't a guest state of this version. */
export function isGuestState(x: unknown): x is GuestState {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    o.v === GUEST_STATE_VERSION &&
    typeof o.settings === "object" &&
    o.settings !== null &&
    typeof (o.settings as Record<string, unknown>).timezone === "string" &&
    ["problems", "sessions", "attempts", "reviewItems", "errorReviews", "activity"].every((k) => Array.isArray(o[k]))
  );
}

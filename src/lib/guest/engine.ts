// Guest mode: the same trainer / review / plan rules as the signed-in app, but over a plain
// JSON state kept in the browser. Functions mutate the draft state they are given; the
// provider clones before calling and persists afterwards. No I/O here, so it is unit-testable.
import demoProblems from "../../../scripts/demo/problems.json";
import { addDays, localDate } from "../dates";
import {
  ERROR_REVIEW_TARGET,
  evaluateDay,
  khanRequiredOn,
  requiredItems,
  type ActivityRow,
  type DayStatus,
  type PlanItem,
} from "../plan";
import { applyMiss, applyTwinOutcome, primaryTechnique } from "../review";
import { comfortLevel, pickTrainerProblems, type TagStat } from "../trainer";
import type { ProblemInput, ProblemStatus } from "../problem-input";

export const GUEST_STATE_VERSION = 1;
const MAX_MINUTES_PER_PROBLEM = 20;

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

// ---------- plan / streak ----------

function activityRows(s: GuestState, date: string): ActivityRow[] {
  return s.activity.filter((a) => a.local_date === date).map(({ item, minutes, completed }) => ({ item, minutes, completed }));
}

export function dayStatus(s: GuestState, date: string): DayStatus {
  return evaluateDay(requiredItems(date, { khanRequired: khanRequiredOn(date) }), activityRows(s, date));
}

/** date -> minimum met, for the last `days` days. */
export function keptMap(s: GuestState, today: string, days = 70): Map<string, boolean> {
  const from = addDays(today, -days);
  const dates = new Set(s.activity.filter((a) => a.local_date >= from && a.local_date <= today).map((a) => a.local_date));
  const kept = new Map<string, boolean>();
  for (const d of dates) kept.set(d, dayStatus(s, d).minimumMet);
  return kept;
}

function upsertActivity(s: GuestState, date: string, item: PlanItem, minutes: number, completed: boolean) {
  const row = s.activity.find((a) => a.local_date === date && a.item === item);
  if (row) {
    row.minutes = minutes;
    row.completed = completed;
  } else s.activity.push({ local_date: date, item, minutes, completed });
}

// ---------- trainer ----------

function studentStats(s: GuestState) {
  const byId = new Map(s.problems.map((p) => [p.id, p]));
  const rows = [...s.attempts]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 500)
    .flatMap((a) => {
      const p = byId.get(a.problem_id);
      return p ? [{ a, p }] : [];
    });
  const tagStats = new Map<string, TagStat>();
  for (const { a, p } of rows) {
    if (a.familiar) continue;
    for (const t of p.technique_tags) {
      const st = tagStats.get(t) ?? { attempts: 0, correct: 0 };
      st.attempts++;
      if (a.correct) st.correct++;
      tagStats.set(t, st);
    }
  }
  const comfort = comfortLevel(
    rows.slice(0, 60).map(({ a, p }) => ({ difficulty: p.difficulty, correct: a.correct, familiar: a.familiar })),
  );
  return { tagStats, comfort };
}

/** Today's trainer session, created on first visit. Null when no fresh problems are left. */
export function getOrCreateSession(s: GuestState, today: string): GuestSession | null {
  const existing = s.sessions.find((x) => x.local_date === today);
  if (existing) return existing;

  const seen = new Set(s.attempts.map((a) => a.problem_id));
  const byId = new Map(s.problems.map((p) => [p.id, p]));
  const candidates = s.problems
    .filter((p) => p.status === "train" && !seen.has(p.id))
    .map((p) => ({ id: p.id, difficulty: p.difficulty, techniqueTags: p.technique_tags }));
  const dueItems = s.reviewItems
    .filter((r) => r.status === "pending" && r.due_date <= today)
    .map((r) => ({
      id: r.id,
      techniqueTag: r.technique_tag,
      dueDate: r.due_date,
      originProblemId: r.origin_problem_id,
      originDifficulty: (r.origin_problem_id && byId.get(r.origin_problem_id)?.difficulty) || null,
    }));
  const { tagStats, comfort } = studentStats(s);
  const picks = pickTrainerProblems({ candidates, dueItems, tagStats, comfort });
  if (picks.length === 0) return null;

  const session: GuestSession = {
    id: uid(),
    local_date: today,
    problem_ids: picks.map((p) => p.problemId),
    slot_reasons: picks.map((p) => p.reason),
    review_item_ids: picks.map((p) => p.reviewItemId),
    completed_at: null,
  };
  s.sessions.push(session);
  return session;
}

/** Recompute the trainer activity row from the session's attempts. */
function refreshTrainerActivity(s: GuestState, session: GuestSession): boolean {
  const rows = s.attempts.filter((a) => a.session_id === session.id);
  const minutes = rows.reduce((sum, r) => sum + Math.min(r.seconds / 60, MAX_MINUTES_PER_PROBLEM), 0);
  const finalized = new Set(rows.filter((r) => r.finalized).map((r) => r.problem_id));
  // Problems deleted from the bank mid-session can never be finalized; don't wait on them.
  const alive = new Set(s.problems.map((p) => p.id));
  const required = session.problem_ids.filter((id) => alive.has(id));
  const completed = required.length > 0 && required.every((id) => finalized.has(id));
  upsertActivity(s, session.local_date, "trainer", Math.round(minutes * 10) / 10, completed);
  if (completed && !session.completed_at) session.completed_at = new Date().toISOString();
  return completed;
}

export interface SubmitInput {
  sessionId: string;
  problemId: string;
  answer: string | null;
  confidence: number;
  familiar: boolean;
  seconds: number;
}

export type SubmitOutcome =
  | { ok: true; attemptId: string; correct: boolean; correctAnswer: string; solutionUrl: string | null }
  | { ok: false; error: string };

export function submitAttempt(s: GuestState, input: SubmitInput, today: string): SubmitOutcome {
  const { sessionId, problemId, answer, confidence, familiar } = input;
  const seconds = Math.max(0, Math.min(7200, Math.round(input.seconds)));
  if (answer !== null && !["A", "B", "C", "D", "E"].includes(answer)) return { ok: false, error: "Invalid submission" };
  if (![1, 2, 3].includes(confidence)) return { ok: false, error: "Invalid submission" };

  const session = s.sessions.find((x) => x.id === sessionId);
  if (!session) return { ok: false, error: "Session not found" };
  const idx = session.problem_ids.indexOf(problemId);
  if (idx < 0) return { ok: false, error: "Problem is not in this session" };
  const problem = s.problems.find((p) => p.id === problemId);
  if (!problem) return { ok: false, error: "Problem not found" };
  const solutionUrl = problem.solution_url ?? problem.url ?? null;

  const prior = s.attempts.find((a) => a.session_id === sessionId && a.problem_id === problemId);
  if (prior) return { ok: true, attemptId: prior.id, correct: prior.correct, correctAnswer: problem.answer, solutionUrl };

  const correct = answer === problem.answer;
  const reviewItemId = session.review_item_ids[idx] ?? null;
  const attempt: GuestAttempt = {
    id: uid(),
    problem_id: problemId,
    session_id: sessionId,
    review_item_id: reviewItemId,
    local_date: session.local_date,
    seconds,
    answer,
    correct,
    confidence,
    familiar,
    key_idea: null,
    error_type: null,
    finalized: false,
    created_at: new Date().toISOString(),
  };
  s.attempts.push(attempt);

  // Spaced review bookkeeping.
  const item = reviewItemId ? s.reviewItems.find((r) => r.id === reviewItemId) : undefined;
  if (item) {
    const next = applyTwinOutcome({ stage: item.stage, dueDate: item.due_date, status: item.status }, { correct, familiar }, today);
    item.stage = next.stage;
    item.due_date = next.dueDate;
    item.status = next.status;
  } else if (!correct) {
    const tag = primaryTechnique(problem.technique_tags);
    if (tag) {
      const existing = s.reviewItems.find((r) => r.technique_tag === tag && r.status === "pending");
      const next = applyMiss(existing ? { stage: existing.stage, dueDate: existing.due_date, status: existing.status } : null, today);
      if (existing) {
        existing.stage = next.stage;
        existing.due_date = next.dueDate;
        existing.origin_problem_id = problemId;
      } else {
        s.reviewItems.push({
          id: uid(),
          technique_tag: tag,
          origin_problem_id: problemId,
          stage: next.stage,
          due_date: next.dueDate,
          status: "pending",
        });
      }
    }
  }

  refreshTrainerActivity(s, session);
  return { ok: true, attemptId: attempt.id, correct, correctAnswer: problem.answer, solutionUrl };
}

export interface FinalizeInput {
  attemptId: string;
  keyIdea: string;
  errorType: string | null;
}

export function finalizeAttempt(s: GuestState, input: FinalizeInput): { ok: boolean; error?: string; dayComplete?: boolean } {
  const keyIdea = input.keyIdea.trim();
  if (keyIdea.length < 5) return { ok: false, error: "Write at least a short sentence" };
  if (keyIdea.length > 280) return { ok: false, error: "Keep it to one sentence" };
  const attempt = s.attempts.find((a) => a.id === input.attemptId);
  if (!attempt) return { ok: false, error: "Attempt not found" };
  if (!attempt.correct && !input.errorType) return { ok: false, error: "Pick an error type for the miss" };
  attempt.key_idea = keyIdea;
  attempt.error_type = attempt.correct ? null : input.errorType;
  attempt.finalized = true;
  const session = s.sessions.find((x) => x.id === attempt.session_id);
  return { ok: true, dayComplete: session ? refreshTrainerActivity(s, session) : false };
}

// ---------- error log ----------

function pendingMisses(s: GuestState) {
  const reviewed = new Set(s.errorReviews.map((r) => r.attempt_id));
  return s.attempts.filter((a) => !a.correct && a.finalized && !reviewed.has(a.id));
}

export function reviewError(s: GuestState, input: { attemptId: string; takeaway: string; minutes: number }, today: string): { error?: string } {
  const takeaway = input.takeaway.trim();
  if (takeaway.length < 5) return { error: "Write what you'll do differently" };
  if (takeaway.length > 500) return { error: "Keep it under 500 characters" };
  if (s.errorReviews.some((r) => r.attempt_id === input.attemptId)) return { error: "Already reviewed" };
  if (!s.attempts.some((a) => a.id === input.attemptId)) return { error: "Attempt not found" };
  s.errorReviews.push({ attempt_id: input.attemptId, takeaway, local_date: today });

  const reviewedToday = s.errorReviews.filter((r) => r.local_date === today).length;
  const remaining = pendingMisses(s).length;
  const done = reviewedToday >= ERROR_REVIEW_TARGET || (reviewedToday > 0 && remaining === 0);
  const current = s.activity.find((a) => a.local_date === today && a.item === "error_review")?.minutes ?? 0;
  const minutes = Math.max(0, Math.min(30, input.minutes));
  upsertActivity(s, today, "error_review", Math.round((current + minutes) * 10) / 10, done);
  return {};
}

/** When the error log is empty there is nothing to review; mark it done. */
export function markNothingToReview(s: GuestState, today: string): { error?: string } {
  if (pendingMisses(s).length) return { error: "There are still misses to review" };
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

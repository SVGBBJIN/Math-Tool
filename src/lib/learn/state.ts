// The learning record for one student: a log of evidence, today's plan and the misses log.
// Everything else (mastery states, review dates, what to show next) is DERIVED from the
// evidence log by pure functions, so there is one source of truth and nothing to keep in sync.
import type { Dimension } from "./cards/types";

/** Version of the stored document. 1 was the move-based engine's progress; 2 is this. */
export const LEARN_VERSION = 2;
export const MAX_EVENTS = 8000;

/** skipped = the student chose "show me" instead of answering. Honest, and never a guess. */
export type Outcome = "correct" | "incorrect" | "skipped";
export type Role = "discover" | "reinforce" | "apply";
export type Slot = Role | "extra" | "explore";

export interface Evidence {
  id: string;
  at: string;
  date: string;
  cardId: string;
  /** Hand-written card id, or the generator family for a variant: what counts as "the same problem". */
  family: string;
  conceptId: string;
  objectiveId: string;
  dimension: Dimension;
  outcome: Outcome;
  /** Checked answers given (1 or 2). */
  attempts: number;
  hintUsed: boolean;
  /** The student judged their own answer against a model. */
  selfReported: boolean;
  slot: Slot;
  /** Days since this concept was last practised, or null on first contact. */
  gapDays: number | null;
  /** The same problem was answered recently (or a same-structure variant very recently), so recall may be standing in for reasoning. */
  repeat: boolean;
  /** Imported from the earlier move-based engine. Counts as exposure, never as clean evidence. */
  legacy?: boolean;
}

export interface DailySlot {
  role: Role;
  cardId: string;
  conceptId: string;
  /** Why this card was chosen, in words a student can read. */
  reason: string;
  done: boolean;
  outcome: Outcome | null;
}
export interface DailyPlan { date: string; slots: DailySlot[] }

/** A wrong or skipped answer on a card that asks for recognition, application or transfer. */
export interface Miss {
  id: string;
  at: string;
  date: string;
  cardId: string;
  conceptId: string;
  problem: string;
  userAnswer: string;
  correctAnswer: string;
  outcome: "incorrect" | "skipped";
  /** One of ERROR_TYPES in src/lib/tags.ts, if the student classified it. */
  errorType: string | null;
  note: string;
  /** "Next time I will…" from the error review. */
  takeaway: string | null;
  reviewedOn: string | null;
}

export interface LearnState {
  v: typeof LEARN_VERSION;
  createdAt: string;
  events: Evidence[];
  daily: DailyPlan | null;
  misses: Miss[];
}

export function emptyLearnState(now: Date = new Date()): LearnState {
  return { v: LEARN_VERSION, createdAt: now.toISOString(), events: [], daily: null, misses: [] };
}

let counter = 0;
export const newId = (now: Date = new Date()) => `${now.getTime().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// Recording a finished card: appends one piece of evidence and reports what it changed.
// This is the only place the learning record is written to; the UI never edits mastery.
import { daysBetween } from "../dates";
import { familyOf, getCard } from "./cards";
import { answerText } from "./cards/check";
import { plainText } from "./cards/markup";
import { DIMENSION_OF } from "./cards/types";
import { STANDARD, snapshots, type MasteryState } from "./mastery";
import { MAX_EVENTS, newId, type Evidence, type LearnState, type Miss, type Outcome, type Slot } from "./state";

export interface CardResult {
  cardId: string;
  slot: Slot;
  outcome: Outcome;
  /** Checked answers given (0 when skipped straight to the explanation). */
  attempts: number;
  hintUsed: boolean;
  selfReported: boolean;
  /** What the student answered, in words (for the misses log). */
  answered: string;
}

export interface StateChange { conceptId: string; from: MasteryState; to: MasteryState }
export interface Recorded {
  state: LearnState;
  evidence: Evidence;
  /** Concepts whose mastery state moved because of this card (including ones it unlocked). */
  changes: StateChange[];
  missId: string | null;
}

export function recordResult(state: LearnState, result: CardResult, today: string, now: Date = new Date()): Recorded {
  const card = getCard(result.cardId);
  if (!card) throw new Error(`Cannot record unknown card ${result.cardId}`);
  const family = familyOf(card.id);
  const before = snapshots(state.events);

  const previous = state.events.filter((e) => e.conceptId === card.conceptId);
  const last = previous[previous.length - 1];
  const lastSame = [...state.events].reverse().find((e) => e.family === family);
  const evidence: Evidence = {
    id: newId(now), at: now.toISOString(), date: today,
    cardId: card.id, family, conceptId: card.conceptId, objectiveId: card.objectiveId, dimension: DIMENSION_OF[card.type],
    outcome: result.outcome, attempts: Math.max(0, Math.min(2, Math.round(result.attempts))), hintUsed: result.hintUsed, selfReported: result.selfReported, slot: result.slot,
    gapDays: last ? Math.max(0, daysBetween(last.date, today)) : null,
    repeat: !!lastSame && daysBetween(lastSame.date, today) < STANDARD.repeatWindow,
  };

  let next: LearnState = { ...state, events: [...state.events, evidence].slice(-MAX_EVENTS) };

  // Today's plan: tick the slot this card filled.
  if (next.daily?.date === today) {
    let marked = false;
    next = {
      ...next,
      daily: {
        ...next.daily,
        slots: next.daily.slots.map((s) => {
          if (marked || s.done || s.cardId !== card.id) return s;
          marked = true;
          return { ...s, done: true, outcome: result.outcome };
        }),
      },
    };
  }

  // Misses log: only for cards that ask the student to recognise, apply or adapt. A wrong
  // prediction on a teaching card is part of learning, not an error to review.
  let missId: string | null = null;
  if (result.outcome !== "correct" && evidence.dimension !== "comprehension") {
    missId = newId(now);
    const miss: Miss = {
      id: missId, at: evidence.at, date: today, cardId: card.id, conceptId: card.conceptId,
      problem: plainText(card.prompt), userAnswer: result.outcome === "skipped" ? "" : result.answered, correctAnswer: plainText(answerText(card)),
      outcome: result.outcome, errorType: null, note: "", takeaway: null, reviewedOn: null,
    };
    next = { ...next, misses: [...next.misses, miss] };
  }

  const after = snapshots(next.events);
  const changes: StateChange[] = [];
  for (const [id, snap] of after) {
    const from = before.get(id)!.state;
    if (from !== snap.state && (id === card.conceptId || from === "locked")) changes.push({ conceptId: id, from, to: snap.state });
  }
  return { state: next, evidence, changes, missId };
}

export function setMissDetails(state: LearnState, id: string, errorType: string | null, note: string): LearnState {
  return { ...state, misses: state.misses.map((m) => (m.id === id ? { ...m, errorType, note: note.trim().slice(0, 140) } : m)) };
}
export function setMissTakeaway(state: LearnState, id: string, takeaway: string, today: string): LearnState {
  return { ...state, misses: state.misses.map((m) => (m.id === id ? { ...m, takeaway: takeaway.trim().slice(0, 500), reviewedOn: today } : m)) };
}
export const unreviewedMisses = (state: LearnState) => state.misses.filter((m) => !m.takeaway);

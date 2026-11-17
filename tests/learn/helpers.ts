import { getCard } from "@/lib/learn/cards";
import { keyResponse, wrongResponse } from "@/lib/learn/cards/validate";
import { check, responseText } from "@/lib/learn/cards/check";
import { recordResult } from "@/lib/learn/record";
import { ensureDaily } from "@/lib/learn/select";
import type { LearnState, Slot } from "@/lib/learn/state";

export const DAY0 = "2027-01-04";

export interface Opts { correct?: boolean; hint?: boolean; attempts?: number; slot?: Slot; skip?: boolean }
/** Answer a card the way a student would, through the real checker, and record it. */
export function answer(state: LearnState, cardId: string, today: string, o: Opts = {}): LearnState {
  const card = getCard(cardId)!;
  const correct = o.correct ?? true;
  const response = correct ? keyResponse(card) : wrongResponse(card);
  const result = check(card, response);
  if (!o.skip && result.status !== (correct ? "correct" : "incorrect")) throw new Error(`checker disagreed on ${cardId}`);
  return recordResult(state, {
    cardId, slot: o.slot ?? "explore", outcome: o.skip ? "skipped" : result.status === "correct" ? "correct" : "incorrect",
    attempts: o.skip ? 0 : (o.attempts ?? 1), hintUsed: !!o.hint, selfReported: !!result.selfReported, answered: responseText(card, response),
  }, today, new Date(`${today}T12:00:00Z`)).state;
}

/** Do today's three cards. `correct` decides each answer from the card id. */
export function playDay(state: LearnState, today: string, correct: (cardId: string) => boolean = () => true): LearnState {
  let s = ensureDaily(state, today);
  for (const slot of s.daily!.slots) s = answer(s, slot.cardId, today, { correct: correct(slot.cardId), slot: slot.role });
  return s;
}

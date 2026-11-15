// All topic packs, and the few lookups the rest of the app needs. To add a topic, write
// a pack file and list it here.
import { exprModule, type ExprCard } from "./expr/module";
import { structModule, type StructCard } from "./struct/module";
import { counting } from "./packs/counting";
import { quadratics } from "./packs/quadratics";
import type { ApplyResult, CardBase, EngineModule, MoveInput, Skill, TopicPack } from "./types";

export type Card = ExprCard | StructCard;
export const PACKS: TopicPack<Card>[] = [quadratics as TopicPack<Card>, counting as TopicPack<Card>];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyModule = EngineModule<any, any>;
export function moduleOf(card: CardBase): AnyModule {
  return card.module === "expr" ? exprModule : structModule;
}

const HAND = new Map<string, Card>(PACKS.flatMap((p) => p.cards.map((c) => [c.id, c] as [string, Card])));
const SKILLS = new Map<string, { skill: Skill; pack: TopicPack<Card> }>(PACKS.flatMap((p) => p.skills.map((s) => [s.id, { skill: s, pack: p }] as [string, { skill: Skill; pack: TopicPack<Card> }])));

/** Skills in teaching order (pack order; prerequisites always come first). */
export const ALL_SKILLS: Skill[] = PACKS.flatMap((p) => p.skills);
export const skillOf = (id: string) => SKILLS.get(id)?.skill;
export const packOfSkill = (id: string) => SKILLS.get(id)?.pack;
export const topicOfSkill = (id: string) => SKILLS.get(id)?.pack.topic ?? "logic_misc";

export interface Replay {
  ok: boolean;
  /** The line after each step (index 0 = the starting line). */
  lines: string[];
  error?: string;
}
/** Run a card's reference path through the real verifier. */
export function replay(card: Card): Replay {
  const mod = moduleOf(card);
  let state = mod.init(card);
  const lines = [mod.show(state, card)];
  let done = false;
  for (const [i, step] of card.path.entries()) {
    const r: ApplyResult<unknown> = mod.apply(card, state, step);
    if (!r.ok) return { ok: false, lines, error: `step ${i + 1} (${step.move}): ${r.reason}` };
    state = r.state;
    done = !!r.done;
    lines.push(mod.show(state, card));
  }
  if (!done || !mod.isGoal(card, state)) return { ok: false, lines, error: "the reference path does not reach the goal" };
  return { ok: true, lines };
}

/** A fresh variant. Seeds that fail the replay are skipped, so only verified cards are shown. */
export function generateCard(skillId: string, type: "rep" | "twist", seed: number): Card {
  const pack = packOfSkill(skillId);
  if (!pack) throw new Error(`Unknown skill ${skillId}`);
  for (let i = 0; i < 25; i++) {
    const card = pack.generate(skillId, type, seed + i * 1009);
    if (replay(card).ok) return card;
  }
  throw new Error(`Generator for ${skillId}/${type} produced no valid card`);
}

/** Hand-written cards by id; generated ones by their "skill~type~seed" id. */
export function getCard(id: string): Card | undefined {
  const hand = HAND.get(id);
  if (hand) return hand;
  const [skillId, type, seed] = id.split("~");
  if (!SKILLS.has(skillId) || (type !== "rep" && type !== "twist") || !/^\d+$/.test(seed ?? "")) return undefined;
  try {
    const card = packOfSkill(skillId)!.generate(skillId, type, Number(seed));
    return replay(card).ok ? card : undefined;
  } catch {
    return undefined;
  }
}

/** The step the reference path would take from this exact line, if the student is still on it. */
export function nextReferenceStep(card: Card, currentLine: string): MoveInput | null {
  const mod = moduleOf(card);
  let state = mod.init(card);
  for (const step of card.path) {
    if (mod.show(state, card) === currentLine) return step;
    const r = mod.apply(card, state, step);
    if (!r.ok) return null;
    state = r.state;
  }
  return null;
}

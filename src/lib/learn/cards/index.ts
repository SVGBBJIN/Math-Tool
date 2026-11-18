// Card engine: the bank of validated cards and the lookups the rest of the system uses.
import * as algebra from "../content/algebra";
import * as counting from "../content/counting";
import * as geometry from "../content/geometry";
import * as numberTheory from "../content/number-theory";
import type { Card, CardFamily, CardType } from "./types";

export type { Card, CardFamily, CardType, Dimension, Figure, FigItem, Interaction, Response } from "./types";
export { CARD_TYPES, DIMENSION_OF } from "./types";

const PACKS = [numberTheory, algebra, counting, geometry];
/** Hand-written cards. Within a concept, file order is teaching order. */
export const CARDS: Card[] = PACKS.flatMap((p) => p.CARDS);
export const FAMILIES: CardFamily[] = PACKS.flatMap((p) => p.FAMILIES);

const BY_ID = new Map(CARDS.map((c) => [c.id, c]));
const FAMILY_BY_ID = new Map(FAMILIES.map((f) => [f.id, f]));
const BY_CONCEPT = new Map<string, Card[]>();
for (const c of CARDS) BY_CONCEPT.set(c.conceptId, [...(BY_CONCEPT.get(c.conceptId) ?? []), c]);

/** Teaching order inside a concept: ideas first, then spotting them, then using them, then adapting them. */
const TYPE_ORDER: Record<CardType, number> = { insight: 0, technique: 1, recognition: 2, application: 3, variation: 4 };
for (const [id, cards] of BY_CONCEPT) {
  BY_CONCEPT.set(id, [...cards].sort((a, b) => TYPE_ORDER[a.type] - TYPE_ORDER[b.type] || a.difficulty - b.difficulty || CARDS.indexOf(a) - CARDS.indexOf(b)));
}

export const cardsOf = (conceptId: string): Card[] => BY_CONCEPT.get(conceptId) ?? [];
export const familiesOf = (conceptId: string): CardFamily[] => FAMILIES.filter((f) => f.conceptId === conceptId);
export const hasCards = (conceptId: string): boolean => BY_CONCEPT.has(conceptId);
export const CONCEPTS_WITH_CARDS: string[] = [...BY_CONCEPT.keys()];

/** "family~seed" → its parts, or null for a hand-written id. */
export function parseVariantId(id: string): { family: string; seed: number } | null {
  const m = /^(.+)~(\d{1,9})$/.exec(id);
  return m ? { family: m[1], seed: Number(m[2]) } : null;
}
export const variantId = (family: string, seed: number) => `${family}~${seed}`;

/** Any card by id: hand-written, or a generated variant rebuilt from its seed. */
export function getCard(id: string): Card | undefined {
  const hand = BY_ID.get(id);
  if (hand) return hand;
  const v = parseVariantId(id);
  const fam = v && FAMILY_BY_ID.get(v.family);
  return fam && v ? fam.make(v.seed) : undefined;
}

/**
 * What counts as "the same problem" for repetition and for mastery: a hand-written card
 * is its own family; all variants of a generator share one.
 */
export const familyOf = (cardId: string): string => parseVariantId(cardId)?.family ?? cardId;
export const familyById = (id: string): CardFamily | undefined => FAMILY_BY_ID.get(id);

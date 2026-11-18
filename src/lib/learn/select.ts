// Progression engine: which cards a student should see next.
//
// The default day is three cards: Discover (a new idea), Reinforce (bring back something
// learned) and Apply (use an idea on a problem not seen before). The mix adapts:
//
//   - two or more concepts with recent misses, or a pile of overdue reviews → no new
//     material that day: Reinforce, Reinforce, Apply;
//   - three concepts already open (met but not yet used independently) → finish those
//     before starting another;
//   - nothing learned yet → all three cards walk through the first concept.
//
// Cards are never chosen for being easy. Within a concept the order is fixed by teaching
// order and by what evidence is still missing, and a problem is not repeated while an
// unseen one (or a fresh variant) exists.
import { addDays, daysBetween } from "../dates";
import { cardsOf, familiesOf, familyOf, getCard, hasCards, variantId } from "./cards";
import { validateCard } from "./cards/validate";
import type { Card, CardType } from "./cards/types";
import { FAMILY_VERIFIERS } from "./content/verifiers";
import { CONCEPTS, COURSE, conceptOf, domainWeight, importanceOf, orderOf } from "./curriculum";
import { eventsByConcept, rank, snapshots, type ConceptSnapshot } from "./mastery";
import { isDue, overdueDays, scheduleOf, type Schedule } from "./review";
import type { DailyPlan, DailySlot, Evidence, LearnState, Role } from "./state";

export const DAILY_CARDS = 3;
/** Concepts met but not yet used independently. At this many, no new concept is started. */
export const MAX_OPEN = 3;
/** A seen hand-written card may come back only after this many days, and only when nothing fresh exists. */
export const REUSE_AFTER_DAYS = 7;
const TEACHING: CardType[] = ["insight", "technique"];

export interface Pick { cardId: string; conceptId: string; reason: string }

interface Ctx {
  today: string;
  events: Evidence[];
  byConcept: Map<string, Evidence[]>;
  snaps: Map<string, ConceptSnapshot>;
  schedules: Map<string, Schedule | null>;
  /** family → the last date it was answered. */
  lastSeen: Map<string, string>;
  /** Card ids and families already planned or answered in this session of planning. */
  used: Set<string>;
  /** Concepts with a card planned today, in the order they were planned. */
  planned: string[];
  newStarted: boolean;
  allowNew: boolean;
}

function context(state: LearnState, today: string): Ctx {
  const byConcept = eventsByConcept(state.events);
  const snaps = snapshots(state.events);
  const schedules = new Map(CONCEPTS.map((c) => [c.id, scheduleOf(byConcept.get(c.id) ?? [])]));
  const lastSeen = new Map<string, string>();
  for (const e of state.events) lastSeen.set(e.family, e.date);
  const seen = [...snaps.values()].filter((s) => s.seen && s.hasCards);
  const weak = seen.filter((s) => s.needsReinforcement).length;
  const open = seen.filter((s) => s.state === "introduced" || s.state === "developing").length;
  const due = seen.filter((s) => isDue(schedules.get(s.conceptId) ?? null, today)).length;
  return { today, events: state.events, byConcept, snaps, schedules, lastSeen, used: new Set(), planned: [], newStarted: false, allowNew: weak < 2 && open < MAX_OPEN && due < 5 };
}

const take = (ctx: Ctx, card: Card) => {
  ctx.used.add(card.id);
  ctx.used.add(familyOf(card.id));
  if (!ctx.planned.includes(card.conceptId)) ctx.planned.push(card.conceptId);
};
const isFree = (ctx: Ctx, card: Card) => !ctx.used.has(card.id) && !ctx.used.has(familyOf(card.id));
/** A card that leans on other concepts waits until those are at least Developing. */
const ready = (ctx: Ctx, card: Card) => (card.requires ?? []).every((r) => rank(ctx.snaps.get(r)?.state ?? "available") >= rank("developing"));

const unseen = (ctx: Ctx, conceptId: string, types: CardType[]) =>
  cardsOf(conceptId).filter((c) => types.includes(c.type) && !ctx.lastSeen.has(c.id) && isFree(ctx, c) && ready(ctx, c));

/** A generated variant that has not been shown, re-verified here before it can be shown. */
function freshVariant(ctx: Ctx, conceptId: string, types: CardType[]): Card | null {
  const verifiers = FAMILY_VERIFIERS as Record<string, ((p: Record<string, number>) => string) | undefined>;
  for (const type of types) {
    for (const fam of familiesOf(conceptId).filter((f) => f.type === type && !ctx.used.has(f.id))) {
      const shown = new Set(ctx.events.filter((e) => e.family === fam.id).map((e) => e.cardId));
      const start = shown.size + 1;
      for (let seed = start; seed < start + 25; seed++) {
        const id = variantId(fam.id, seed);
        if (shown.has(id) || ctx.used.has(id)) continue;
        const card = fam.make(seed);
        const verify = verifiers[fam.id];
        if (verify && card.params && validateCard(card, () => verify(card.params!)).length === 0) return card;
      }
    }
  }
  return null;
}

/**
 * A practice card for a concept. `types` is in order of preference. Unseen hand-written
 * cards come first (weak objectives before others), then a fresh variant, and only then a
 * hand-written card last seen at least REUSE_AFTER_DAYS ago.
 */
function practiceCard(ctx: Ctx, conceptId: string, types: CardType[]): Card | null {
  const weak = ctx.snaps.get(conceptId)?.weakObjectives ?? [];
  const fresh = unseen(ctx, conceptId, types).sort((a, b) => Number(weak.includes(b.objectiveId)) - Number(weak.includes(a.objectiveId)) || types.indexOf(a.type) - types.indexOf(b.type));
  if (fresh.length) return fresh[0];
  const variant = freshVariant(ctx, conceptId, types);
  if (variant) return variant;
  const cutoff = addDays(ctx.today, -REUSE_AFTER_DAYS);
  const old = cardsOf(conceptId)
    .filter((c) => types.includes(c.type) && isFree(ctx, c) && ready(ctx, c) && (ctx.lastSeen.get(c.id) ?? "9999") <= cutoff)
    .sort((a, b) => ctx.lastSeen.get(a.id)!.localeCompare(ctx.lastSeen.get(b.id)!));
  return old[0] ?? null;
}

const pick = (ctx: Ctx, card: Card | null | undefined, reason: string): Pick | null => {
  if (!card) return null;
  take(ctx, card);
  return { cardId: card.id, conceptId: card.conceptId, reason };
};
const snapsWithCards = (ctx: Ctx) => [...ctx.snaps.values()].filter((s) => s.hasCards);
const nameOf = (id: string) => conceptOf(id)?.name ?? id;

/** The concept to start next: unlocked, untouched, from the domain furthest below its share of the contest. */
export function nextNewConcept(ctx: { snaps: Map<string, ConceptSnapshot>; planned?: string[] }): string | null {
  const started = [...ctx.snaps.values()].filter((s) => s.seen || ctx.planned?.includes(s.conceptId));
  const candidates = [...ctx.snaps.values()].filter((s) => s.hasCards && s.state === "available" && !ctx.planned?.includes(s.conceptId));
  if (!candidates.length) return null;
  const total = COURSE.domains.reduce((sum, d) => sum + domainWeight(d.id), 0);
  const deficit = (id: string) => {
    const domain = conceptOf(id)!.domain;
    const have = started.length ? started.filter((s) => conceptOf(s.conceptId)!.domain === domain).length / started.length : 0;
    return domainWeight(domain) / total - have;
  };
  return candidates.sort((a, b) => deficit(b.conceptId) - deficit(a.conceptId) || orderOf(a.conceptId) - orderOf(b.conceptId))[0].conceptId;
}

function fillDiscover(ctx: Ctx): Pick | null {
  // Finish teaching what has been started before opening something new.
  const inProgress = [...new Set([...snapsWithCards(ctx).filter((s) => s.seen).sort((a, b) => (a.firstSeen ?? "").localeCompare(b.firstSeen ?? "")).map((s) => s.conceptId), ...ctx.planned])];
  for (const id of inProgress) {
    const card = unseen(ctx, id, TEACHING)[0];
    if (card) return pick(ctx, card, `The next idea in ${nameOf(id)}.`);
  }
  if (!ctx.allowNew || ctx.newStarted) return null;
  const id = nextNewConcept(ctx);
  const card = id ? unseen(ctx, id, TEACHING)[0] : null;
  if (!card) return null;
  ctx.newStarted = true;
  return pick(ctx, card, `A new idea: ${nameOf(card.conceptId)}.`);
}

function fillReinforce(ctx: Ctx): Pick | null {
  const seen = snapsWithCards(ctx).filter((s) => s.seen);
  // 1. Concepts with recent misses, most depended-on first.
  for (const s of seen.filter((x) => x.needsReinforcement).sort((a, b) => importanceOf(b.conceptId) - importanceOf(a.conceptId))) {
    const card = practiceCard(ctx, s.conceptId, ["recognition", "application", "technique", "insight"]);
    if (card) return pick(ctx, card, "A couple of recent misses on this idea, so here it is again from another angle.");
  }
  // 2. Reviews that are due, most overdue and most depended-on first.
  const due = seen
    .filter((s) => isDue(ctx.schedules.get(s.conceptId) ?? null, ctx.today) && !ctx.planned.includes(s.conceptId))
    .sort((a, b) => overdueDays(ctx.schedules.get(b.conceptId)!, ctx.today) + 2 * importanceOf(b.conceptId) - (overdueDays(ctx.schedules.get(a.conceptId)!, ctx.today) + 2 * importanceOf(a.conceptId)));
  for (const s of due) {
    const types: CardType[] = rank(s.state) < rank("practicing") ? ["recognition", "application"] : ["application", "variation", "recognition"];
    const card = practiceCard(ctx, s.conceptId, types);
    const days = daysBetween(ctx.schedules.get(s.conceptId)!.lastPractised, ctx.today);
    if (card) return pick(ctx, card, `Review: you last practised this idea ${days === 1 ? "yesterday" : `${days} days ago`}.`);
  }
  // 3. Something in progress, least recently practised: can you spot it?
  const open = [...seen.filter((s) => rank(s.state) < rank("proficient")).sort((a, b) => (a.lastSeen ?? "").localeCompare(b.lastSeen ?? "")).map((s) => s.conceptId), ...ctx.planned];
  for (const id of open) {
    const card = unseen(ctx, id, ["recognition"])[0];
    if (card) return pick(ctx, card, "Can you spot where the idea applies?");
  }
  return null;
}

function fillApply(ctx: Ctx): Pick | null {
  const candidates = snapsWithCards(ctx)
    .filter((s) => s.seen && rank(s.state) >= rank("developing") && s.state !== "mastered" && !s.needsReinforcement)
    // Prefer a concept not already in today's plan, then the one practised longest ago.
    .sort((a, b) => Number(ctx.planned.includes(a.conceptId)) - Number(ctx.planned.includes(b.conceptId)) || (a.lastSeen ?? "").localeCompare(b.lastSeen ?? "") || orderOf(a.conceptId) - orderOf(b.conceptId));
  for (const s of candidates) {
    // Difficulty follows evidence: first a plain application, then problems that change the conditions.
    const types: CardType[] = s.state === "developing" ? ["application"] : ["variation", "application"];
    const card = practiceCard(ctx, s.conceptId, types);
    if (card) return pick(ctx, card, card.type === "variation" ? "A familiar idea with the conditions changed." : "Use an idea you know on a problem you haven't seen.");
  }
  return null;
}

/** Last resort, so a day is not left short: anything unseen from what has been started, then a new concept. */
function fillAny(ctx: Ctx): Pick | null {
  const started = [...new Set([...snapsWithCards(ctx).filter((s) => s.seen).map((s) => s.conceptId), ...ctx.planned])];
  for (const id of started) {
    const card = unseen(ctx, id, ["insight", "technique", "recognition", "application", "variation"])[0] ?? freshVariant(ctx, id, ["application", "variation"]);
    if (card) return pick(ctx, card, `More practice with ${nameOf(id)}.`);
  }
  const id = nextNewConcept(ctx);
  const card = id ? unseen(ctx, id, TEACHING)[0] : null;
  return pick(ctx, card, card ? `A new idea: ${nameOf(card.conceptId)}.` : "");
}

const FILL: Record<Role, (ctx: Ctx) => Pick | null> = { discover: fillDiscover, reinforce: fillReinforce, apply: fillApply };
const FALLBACK: Record<Role, Role[]> = { discover: ["discover", "reinforce", "apply"], reinforce: ["reinforce", "apply", "discover"], apply: ["apply", "reinforce", "discover"] };

function fill(ctx: Ctx, role: Role): (Pick & { role: Role }) | null {
  for (const r of FALLBACK[role]) {
    const p = FILL[r](ctx);
    if (p) return { ...p, role: r };
  }
  const p = fillAny(ctx);
  return p ? { ...p, role } : null;
}

/** Today's mix of roles, before any card is chosen. */
export function planRoles(state: LearnState, today: string): Role[] {
  const ctx = context(state, today);
  const seen = snapsWithCards(ctx).filter((s) => s.seen);
  if (!seen.length) return ["discover", "discover", "discover"];
  const weak = seen.filter((s) => s.needsReinforcement).length;
  const due = seen.filter((s) => isDue(ctx.schedules.get(s.conceptId) ?? null, today)).length;
  if (weak >= 2 || due >= 4) return ["reinforce", "reinforce", "apply"];
  return ["discover", "reinforce", "apply"];
}

export function buildDaily(state: LearnState, today: string): DailyPlan {
  const ctx = context(state, today);
  for (const e of state.events) if (e.date === today) { ctx.used.add(e.cardId); ctx.used.add(e.family); }
  const slots: DailySlot[] = [];
  for (const role of planRoles(state, today).slice(0, DAILY_CARDS)) {
    const p = fill(ctx, role);
    if (p) slots.push({ role: p.role, cardId: p.cardId, conceptId: p.conceptId, reason: p.reason, done: false, outcome: null });
  }
  return { date: today, slots };
}

/** Today's plan, built once per day. A plan whose cards no longer exist is rebuilt. */
export function ensureDaily(state: LearnState, today: string): LearnState {
  if (state.daily?.date === today && state.daily.slots.every((s) => getCard(s.cardId))) return state;
  return { ...state, daily: buildDaily(state, today) };
}

export function dailyStatus(state: LearnState, today: string) {
  const slots = state.daily?.date === today ? state.daily.slots : [];
  const done = slots.filter((s) => s.done).length;
  return { total: slots.length, done, complete: slots.length > 0 && done === slots.length };
}

function sessionContext(state: LearnState, today: string): Ctx {
  const ctx = context(state, today);
  for (const e of state.events) if (e.date === today) { ctx.used.add(e.cardId); ctx.used.add(e.family); }
  for (const s of state.daily?.date === today ? state.daily.slots : []) { ctx.used.add(s.cardId); ctx.used.add(familyOf(s.cardId)); }
  ctx.newStarted = state.events.some((e) => e.date === today && ctx.snaps.get(e.conceptId)?.firstSeen === today);
  return ctx;
}

/** One more card after the daily three, for a student who wants to keep going. Null when nothing suitable is left. */
export function nextExtra(state: LearnState, today: string): (Pick & { role: Role }) | null {
  const ctx = sessionContext(state, today);
  const extras = state.events.filter((e) => e.date === today && e.slot === "extra").length;
  return fill(ctx, (["apply", "reinforce", "discover"] as Role[])[extras % 3]);
}

/** The next card when a student opens one concept to work on it: teaching order, then fresh variants. */
export function nextInConcept(state: LearnState, conceptId: string, today: string): Pick | null {
  if (!hasCards(conceptId)) return null;
  const ctx = sessionContext(state, today);
  const card = unseen(ctx, conceptId, ["insight", "technique", "recognition", "application", "variation"])[0] ?? practiceCard(ctx, conceptId, ["application", "variation", "recognition"]);
  return pick(ctx, card, `Working through ${nameOf(conceptId)}.`);
}

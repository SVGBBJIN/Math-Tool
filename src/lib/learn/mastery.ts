// Learning engine: turns the evidence log into a mastery state per concept.
//
// The rules are deliberately few and readable, because a student (or parent) should be
// able to ask "why does it say that?" and get a straight answer:
//
//   Locked      a required prerequisite is not yet at Developing (and you haven't started this).
//   Available   nothing blocks it; not started.
//   Introduced  you have met it.
//   Developing  you have shown you follow the idea (a teaching or recognition card answered,
//               or any clean success), but have not yet used it on your own.
//   Practicing  one application problem solved cleanly.
//   Proficient  two different application problems solved cleanly, the idea recognised
//               cleanly once, and one variation (a changed problem) solved cleanly.
//   Mastered    Proficient, plus two clean successes after gaps of 3+ days, on different
//               days, at least one after 7+ days and at least one on an application or variation.
//
// "Clean" is what separates evidence from completion: right on the first attempt, no hint,
// checked by the app (not self-judged), and not the same problem seen in the last two weeks
// (or a same-structure variant in the last three days).
// A right answer that is not clean still counts as exposure; it never counts towards the
// thresholds above. Recent misses cap a concept at Developing until a clean success returns.
import { cardsOf, hasCards } from "./cards";
import { CONCEPTS, conceptOf, requiredPrereqs } from "./curriculum";
import type { Dimension } from "./cards/types";
import type { Evidence } from "./state";

export type MasteryState = "locked" | "available" | "introduced" | "developing" | "practicing" | "proficient" | "mastered";
export const STATE_ORDER: MasteryState[] = ["locked", "available", "introduced", "developing", "practicing", "proficient", "mastered"];
export const rank = (s: MasteryState) => STATE_ORDER.indexOf(s);

export const STANDARD = {
  /** Different application problems solved cleanly for Proficient. */
  applications: 2,
  recognitions: 1,
  transfers: 1,
  /** A success counts as retention when the concept was last practised at least this many days earlier. */
  retentionGap: 3,
  longGap: 7,
  retentions: 2,
  /** The identical problem answered within this many days is a repeat: recall, not fresh reasoning. */
  repeatWindow: 14,
  /** A variant of the same problem (new numbers, same structure) within this many days is too familiar to count. */
  familiarWindow: 3,
  /** A required prerequisite must reach this state before the daily plan starts a concept. */
  unlockAt: "developing" as MasteryState,
} as const;

export type Grade = "clean" | "assisted" | "miss";
/** How much a response says about independent ability. */
export function grade(e: Evidence): Grade {
  if (e.outcome !== "correct") return "miss";
  return e.attempts === 1 && !e.hintUsed && !e.selfReported && !e.repeat && !e.legacy ? "clean" : "assisted";
}
const GRADED: Dimension[] = ["recognition", "application", "transfer"];
const isGraded = (e: Evidence) => GRADED.includes(e.dimension) && !e.legacy;

export interface DimensionEvidence { clean: number; assisted: number; miss: number }
export interface ConceptSnapshot {
  conceptId: string;
  state: MasteryState;
  hasCards: boolean;
  seen: boolean;
  /** Recent misses: the next cards for this concept should reinforce, not advance. */
  needsReinforcement: boolean;
  /** Per dimension: distinct problems solved cleanly, other right answers, and misses. */
  evidence: Record<Dimension, DimensionEvidence>;
  /** Clean successes that came after a gap of STANDARD.retentionGap days or more. */
  retention: number;
  firstSeen: string | null;
  lastSeen: string | null;
  /** Objectives with more misses than successes lately. */
  weakObjectives: string[];
  /** Required prerequisites that are not yet established. */
  blockedBy: string[];
  /** The single next thing that would move this concept forward. */
  next: string;
}

const emptyEvidence = (): Record<Dimension, DimensionEvidence> => ({
  comprehension: { clean: 0, assisted: 0, miss: 0 },
  recognition: { clean: 0, assisted: 0, miss: 0 },
  application: { clean: 0, assisted: 0, miss: 0 },
  transfer: { clean: 0, assisted: 0, miss: 0 },
});

/** Recent trouble: the latest graded answer was a miss, and so was at least one more of the last four. */
export function isSlipping(events: Evidence[]): boolean {
  const graded = events.filter(isGraded).slice(-4);
  return graded.length >= 2 && grade(graded[graded.length - 1]) === "miss" && graded.filter((e) => grade(e) === "miss").length >= 2;
}

function weakObjectives(events: Evidence[]): string[] {
  const by = new Map<string, Evidence[]>();
  for (const e of events) if (!e.legacy) by.set(e.objectiveId, [...(by.get(e.objectiveId) ?? []), e]);
  return [...by].filter(([, es]) => {
    const recent = es.slice(-3);
    const misses = recent.filter((e) => grade(e) === "miss").length;
    return misses >= 1 && misses * 2 >= recent.length && grade(recent[recent.length - 1]) === "miss";
  }).map(([id]) => id);
}

/** Mastery of one concept from its own events (chronological). Does not know about prerequisites. */
function baseSnapshot(conceptId: string, events: Evidence[]): Omit<ConceptSnapshot, "blockedBy"> {
  const evidence = emptyEvidence();
  const cleanFamilies: Record<Dimension, Set<string>> = { comprehension: new Set(), recognition: new Set(), application: new Set(), transfer: new Set() };
  const retentionDates = new Set<string>();
  let longRetention = false;
  let appliedRetention = false;
  for (const e of events) {
    const g = grade(e);
    if (g === "clean") {
      cleanFamilies[e.dimension].add(e.family);
      if (GRADED.includes(e.dimension) && e.gapDays !== null && e.gapDays >= STANDARD.retentionGap) {
        retentionDates.add(e.date);
        if (e.gapDays >= STANDARD.longGap) longRetention = true;
        if (e.dimension !== "recognition") appliedRetention = true;
      }
    } else evidence[e.dimension][g]++;
  }
  for (const d of Object.keys(evidence) as Dimension[]) evidence[d].clean = cleanFamilies[d].size;

  const seen = events.length > 0;
  const own = events.filter((e) => !e.legacy);
  const followed = events.some((e) => e.outcome === "correct" && (e.dimension === "comprehension" || e.dimension === "recognition" || e.legacy)) || own.some((e) => grade(e) === "clean");
  const practicing = evidence.application.clean >= 1;
  const proficient = evidence.application.clean >= STANDARD.applications && evidence.recognition.clean >= STANDARD.recognitions && evidence.transfer.clean >= STANDARD.transfers;
  const retained = retentionDates.size >= STANDARD.retentions && longRetention && appliedRetention;
  const slipping = isSlipping(events);

  let state: MasteryState = "available";
  if (seen) state = "introduced";
  if (seen && followed) state = "developing";
  if (followed && practicing) state = "practicing";
  if (followed && proficient) state = "proficient";
  if (followed && proficient && retained) state = "mastered";
  if (slipping && rank(state) > rank("developing")) state = "developing";

  const need = (have: number, want: number, one: string, many: string) => (want - have === 1 ? one : many.replace("{n}", String(want - have)));
  let next: string;
  if (!seen) next = "Start with the first idea.";
  else if (slipping) next = "A couple of recent misses: one clean answer on this idea clears it.";
  else if (!followed) next = "Work through a teaching card and answer its question.";
  else if (!practicing) next = "Solve one application problem on your own: first try, no hint.";
  else if (!proficient) {
    const parts = [
      evidence.application.clean < STANDARD.applications ? need(evidence.application.clean, STANDARD.applications, "one more application problem", "{n} more application problems") : "",
      evidence.recognition.clean < STANDARD.recognitions ? "spot the idea once without help" : "",
      evidence.transfer.clean < STANDARD.transfers ? "solve a variation" : "",
    ].filter(Boolean);
    next = `Still needed, each on the first try with no hint: ${parts.join("; ")}.`;
  } else if (!retained) next = "Come back to it after a few days away. Mastery needs it to hold over time (twice, once after a week or more).";
  else next = "Mastered. It will come back occasionally to keep it fresh.";

  return {
    conceptId, state, hasCards: hasCards(conceptId), seen, needsReinforcement: seen && slipping, evidence, retention: retentionDates.size,
    firstSeen: events[0]?.date ?? null, lastSeen: events[events.length - 1]?.date ?? null, weakObjectives: weakObjectives(events), next,
  };
}

export function eventsByConcept(events: Evidence[]): Map<string, Evidence[]> {
  const by = new Map<string, Evidence[]>();
  for (const e of events) {
    const list = by.get(e.conceptId);
    if (list) list.push(e);
    else by.set(e.conceptId, [e]);
  }
  return by;
}

/** A snapshot of every concept in the course, in teaching order. */
export function snapshots(events: Evidence[]): Map<string, ConceptSnapshot> {
  const by = eventsByConcept(events);
  const base = new Map(CONCEPTS.map((c) => [c.id, baseSnapshot(c.id, by.get(c.id) ?? [])]));
  const out = new Map<string, ConceptSnapshot>();
  for (const c of CONCEPTS) {
    const snap = base.get(c.id)!;
    // Only prerequisites that have cards can be established, so only they can block.
    const blockedBy = requiredPrereqs(c).filter((p) => hasCards(p) && rank(base.get(p)!.state) < rank(STANDARD.unlockAt));
    const locked = !snap.seen && blockedBy.length > 0;
    const names = blockedBy.map((p) => conceptOf(p)?.name ?? p).join(" and ");
    out.set(c.id, { ...snap, blockedBy, state: locked ? "locked" : snap.state, next: locked ? `Builds on ${names}. Get that to Developing first.` : snap.next });
  }
  return out;
}

export const STATE_LABEL: Record<MasteryState, string> = {
  locked: "Locked", available: "Available", introduced: "Introduced", developing: "Developing", practicing: "Practicing", proficient: "Proficient", mastered: "Mastered",
};
export const STATE_MEANING: Record<MasteryState, string> = {
  locked: "Builds on an idea you haven't established yet.",
  available: "Ready to start.",
  introduced: "You've met the idea.",
  developing: "You follow the idea; you haven't yet used it on your own.",
  practicing: "You can solve a familiar problem with it.",
  proficient: "You can spot it, use it and adapt it without help.",
  mastered: "It has held up over time.",
};

/** Whether a concept can be taken all the way to Mastered with the cards that exist. */
export function masteryReachable(conceptId: string): boolean {
  const cards = cardsOf(conceptId);
  const n = (t: string, checked = false) => cards.filter((c) => c.type === t && (!checked || c.interaction.kind !== "explain")).length;
  return n("application") >= STANDARD.applications && n("recognition", true) >= STANDARD.recognitions && n("variation") >= STANDARD.transfers;
}

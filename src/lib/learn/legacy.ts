// Migration from version 1: the progress document of the earlier move-based engine
// (quadratics and counting skills, timed move-picking cards).
//
// What carries over, and how much it is trusted:
//   - Each logged card becomes one piece of evidence on the matching concept, flagged
//     `legacy`. Legacy evidence counts as exposure (the concept shows as Developing and is
//     scheduled for review) but never as clean evidence, because the old cards offered a
//     menu of moves and ran against a clock: a pass there is not the same claim as an
//     independent answer here. Nothing is promoted beyond Developing by migration alone.
//   - Cards that ran out of time are dropped: a timeout says nothing about understanding.
//   - Every recorded mistake, with its note and "next time" takeaway, moves to the misses log.
//   - Skill stages, the scaffolding dial, the resurfacing queue and the daily set have no
//     equivalent and are not carried over. They are derived afresh from the evidence.
import { z } from "zod";
import { emptyLearnState, type Evidence, type LearnState, type Miss } from "./state";

const SKILL_MAP: Record<string, { concept: string; objective: string }> = {
  "quad.gcf": { concept: "alg.factoring", objective: "common" },
  "quad.dos": { concept: "alg.factoring", objective: "squares" },
  "quad.tri": { concept: "alg.factoring", objective: "sum-product" },
  "quad.group": { concept: "alg.factoring", objective: "sum-product" },
  "quad.zero": { concept: "alg.quadratic-equations", objective: "zero-product" },
  "quad.cts": { concept: "alg.quadratic-equations", objective: "square" },
  "count.arrange": { concept: "cp.multiplication", objective: "repeat" },
  "count.committee": { concept: "cp.overcounting", objective: "divide" },
  "count.complement": { concept: "cp.complement", objective: "subtract" },
};

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const LegacyLog = z.object({
  at: z.string(), date, cardId: z.string(), skill: z.string(), type: z.enum(["rep", "twist"]),
  result: z.enum(["pass", "assisted", "timeout", "not_sure"]), hintLevel: z.number().optional(),
});
const LegacyMistake = z.object({
  id: z.string(), at: z.string(), date, cardId: z.string(), skill: z.string(), problem: z.string(), userAnswer: z.string(), correctAnswer: z.string(),
  outcome: z.string(), errorType: z.string().nullable().optional(), note: z.string().optional(), takeaway: z.string().nullable().optional(), reviewedOn: z.string().nullable().optional(),
});

/** True for a version-1 document (the move-based engine's progress). */
export function isLegacyDocument(x: unknown): boolean {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return o.v === 1 && typeof o.skills === "object" && Array.isArray(o.logs) && Array.isArray(o.mistakes);
}

export interface LegacyImport { state: LearnState; imported: number; dropped: number }

/** Version 1 → version 2. Entries that cannot be read or mapped are counted, not guessed at. */
export function migrateLegacy(doc: unknown, now: Date = new Date()): LegacyImport {
  const state = emptyLearnState(now);
  if (!isLegacyDocument(doc)) return { state, imported: 0, dropped: 0 };
  const o = doc as { logs: unknown[]; mistakes: unknown[] };
  let dropped = 0;
  const events: Evidence[] = [];
  const lastByConcept = new Map<string, string>();
  o.logs.forEach((raw, i) => {
    const log = LegacyLog.safeParse(raw);
    const map = log.success ? SKILL_MAP[log.data.skill] : undefined;
    if (!log.success || !map) { dropped++; return; }
    const l = log.data;
    if (l.result === "timeout") return;
    events.push({
      id: `legacy-${i}`, at: l.at, date: l.date, cardId: `legacy:${l.cardId}`, family: `legacy:${l.cardId.split("~").slice(0, 2).join("~")}`,
      conceptId: map.concept, objectiveId: `${map.concept}/${map.objective}`, dimension: l.type === "twist" ? "transfer" : "application",
      outcome: l.result === "not_sure" ? "skipped" : "correct", attempts: 1, hintUsed: l.result === "assisted" || (l.hintLevel ?? 0) > 0, selfReported: false,
      slot: "explore", gapDays: null, repeat: false, legacy: true,
    });
    lastByConcept.set(map.concept, l.date);
  });
  events.sort((a, b) => a.at.localeCompare(b.at));

  const misses: Miss[] = [];
  for (const raw of o.mistakes) {
    const m = LegacyMistake.safeParse(raw);
    if (!m.success) { dropped++; continue; }
    const d = m.data;
    misses.push({
      id: `legacy-${d.id}`, at: d.at, date: d.date, cardId: `legacy:${d.cardId}`, conceptId: SKILL_MAP[d.skill]?.concept ?? "",
      problem: d.problem, userAnswer: d.userAnswer, correctAnswer: d.correctAnswer, outcome: d.outcome === "not_sure" ? "skipped" : "incorrect",
      errorType: d.errorType ?? null, note: d.note ?? "", takeaway: d.takeaway ?? null, reviewedOn: d.reviewedOn ?? null,
    });
  }
  return { state: { ...state, events, misses }, imported: events.length + misses.length, dropped };
}

/** Add a legacy document's evidence to an existing record, once (ids make it idempotent). */
export function mergeLegacy(state: LearnState, doc: unknown): LearnState {
  const { state: old } = migrateLegacy(doc);
  const haveEvents = new Set(state.events.map((e) => e.id));
  const haveMisses = new Set(state.misses.map((m) => m.id));
  const events = [...old.events.filter((e) => !haveEvents.has(e.id)), ...state.events].sort((a, b) => a.at.localeCompare(b.at));
  const misses = [...old.misses.filter((m) => !haveMisses.has(m.id)), ...state.misses].sort((a, b) => a.at.localeCompare(b.at));
  return events.length === state.events.length && misses.length === state.misses.length ? state : { ...state, events, misses };
}

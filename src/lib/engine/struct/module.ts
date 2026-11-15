// Module B (structures): the student builds a count out of slots, case splits and
// operations. The verifier does not compare numbers: it ENUMERATES what the structure
// actually builds on a scaled-down version of the problem and compares that, outcome by
// outcome, with a brute-force list of the valid outcomes. A mismatch therefore comes with
// a concrete counterexample: an arrangement built twice, never built, or not allowed.
import type { ApplyResult, CardBase, EngineModule, MoveDef } from "../types";

/** Problem parameters. The scaled-down version uses the same template with a smaller pool. */
export type P = Record<string, number | string>;

export interface SlotDef {
  id: string;
  label: (p: P) => string;
  /** Options shown on the slot. `placed` = slots already in this part. */
  count: (p: P, placed: number) => number;
  /** The actual choices given what was chosen so far; each choice adds facts about the outcome. */
  options: (facts: string[], p: P) => string[][];
}
export interface DivDef {
  id: string;
  label: (p: P) => string;
  value: (p: P) => number;
}
export interface StructTemplate {
  id: string;
  slots: SlotDef[];
  divisors: DivDef[];
  /** Independent brute force: every valid outcome exactly once, in canonical form. */
  universe: (p: P) => string[];
  /** Outcome built by a full path of choices. Default: the sorted facts. */
  canon?: (facts: string[], p: P) => string;
  show: (key: string, p: P) => string;
}

export interface StructCard extends CardBase {
  module: "struct";
  template: string;
  /** Slot and divisor ids offered on this card. */
  palette: string[];
  divs: string[];
  full: P;
  /** Scaled-down version: same slots in the same roles, smaller pool. */
  small: P;
  smallNote: string;
  answer: number;
}

/** One part of the structure: ± (slot × slot × …) ÷ divisor. Parts are added together. */
export interface Term { sign: 1 | -1; slots: string[]; div: string | null }
export interface StructState { terms: Term[] }

const TEMPLATES = new Map<string, StructTemplate>();
export function registerTemplate(t: StructTemplate) {
  TEMPLATES.set(t.id, t);
}
export function template(id: string): StructTemplate {
  const t = TEMPLATES.get(id);
  if (!t) throw new Error(`Unknown counting template ${id}`);
  return t;
}
const slotOf = (t: StructTemplate, id: string) => {
  const s = t.slots.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown slot ${id}`);
  return s;
};
/** A divisor typed as a number that matches none of the template's symmetries: same number at every size. */
const literal = (id: string): DivDef | null =>
  id.startsWith("lit:") ? { id, label: () => `${id.slice(4)}`, value: () => Number(id.slice(4)) } : null;
export const divOf = (t: StructTemplate, id: string) => {
  const d = literal(id) ?? t.divisors.find((x) => x.id === id);
  if (!d) throw new Error(`Unknown divisor ${id}`);
  return d;
};
const defaultCanon = (facts: string[]) => [...facts].sort().join(" ");

const MAX_PATHS = 60_000;

interface TermRun {
  mult: Map<string, number>;
  paths: Map<string, string[]>;
  uneven: { slot: SlotDef; placed: number; expected: number; got: number } | null;
}
/** Walk every path of choices through one part. */
export function runTerm(t: StructTemplate, term: Term, p: P): TermRun {
  const run: TermRun = { mult: new Map(), paths: new Map(), uneven: null };
  const canon = t.canon ?? defaultCanon;
  let leaves = 0;
  const walk = (i: number, facts: string[], trail: string[]) => {
    if (i === term.slots.length) {
      if (++leaves > MAX_PATHS) throw new Error("Structure too large to enumerate");
      const key = canon(facts, p);
      run.mult.set(key, (run.mult.get(key) ?? 0) + 1);
      const seen = run.paths.get(key) ?? [];
      if (seen.length < 2) run.paths.set(key, [...seen, trail.join(" → ")]);
      return;
    }
    const slot = slotOf(t, term.slots[i]);
    const opts = slot.options(facts, p);
    const expected = slot.count(p, i);
    if (opts.length !== expected && !run.uneven) run.uneven = { slot, placed: i, expected, got: opts.length };
    for (const o of opts) walk(i + 1, [...facts, ...o], [...trail, o.map((f) => f.replace(/^[^:]*:/, "")).join("")]);
  };
  walk(0, [], []);
  return run;
}

/** Arithmetic value of the structure from the option counts shown on its slots. */
export function structValue(card: StructCard, s: StructState, p: P = card.full): number {
  const t = template(card.template);
  return s.terms.reduce((sum, term) => {
    const prod = term.slots.reduce((x, id, i) => x * slotOf(t, id).count(p, i), 1);
    return sum + (term.sign * prod) / (term.div ? divOf(t, term.div).value(p) : 1);
  }, 0);
}

export function showStruct(card: StructCard, s: StructState): string {
  if (!s.terms.length) return "(empty)";
  const t = template(card.template);
  const parts = s.terms.map((term, i) => {
    const body = term.slots.length ? term.slots.map((id, j) => slotOf(t, id).count(card.full, j)).join(" × ") : "?";
    const div = term.div ? ` ÷ ${divOf(t, term.div).value(card.full)}` : "";
    return (i === 0 ? (term.sign < 0 ? "− " : "") : term.sign < 0 ? " − " : " + ") + body + div;
  });
  const complete = s.terms.every((term) => term.slots.length);
  return parts.join("") + (complete ? ` = ${structValue(card, s)}` : "");
}

/** `part` (0-based) is the part of the structure responsible for a failure, for highlighting. */
export type CheckResult = { ok: true } | { ok: false; reason: string; detail: string[]; part?: number };

/** Compare what the structure builds on the scaled-down version with the brute-force list. */
export function checkStructure(card: StructCard, s: StructState): CheckResult {
  const t = template(card.template);
  const p = card.small;
  const where = `Smaller version (${card.smallNote})`;
  if (!s.terms.length || s.terms.some((x) => !x.slots.length)) return { ok: false, reason: "Every part needs at least one slot.", detail: [] };

  const total = new Map<string, number>();
  const builtBy = new Map<string, { part: number; paths: string[] }[]>();
  for (const [i, term] of s.terms.entries()) {
    const run = runTerm(t, term, p);
    if (run.uneven) {
      const u = run.uneven;
      return {
        ok: false,
        reason: `"${u.slot.label(card.full)}" doesn't always have the same number of options here.`,
        detail: [`${where}: as slot ${u.placed + 1} it shows ${u.expected} options, but after some earlier choices only ${u.got} are really available. Split into cases or reorder.`],
      };
    }
    const d = term.div ? divOf(t, term.div).value(p) : 1;
    for (const [key, m] of run.mult) {
      if (m % d !== 0) {
        return {
          ok: false,
          part: i,
          reason: `Dividing by ${term.div ? divOf(t, term.div).value(card.full) : d} assumes every outcome was built exactly that many times.`,
          detail: [`${where}: ${t.show(key, p)} was built ${m} time${m === 1 ? "" : "s"}, not ${d} (e.g. ${run.paths.get(key)!.join("  and  ")}).`],
        };
      }
      total.set(key, (total.get(key) ?? 0) + (term.sign * m) / d);
      if (term.sign > 0) builtBy.set(key, [...(builtBy.get(key) ?? []), { part: i + 1, paths: run.paths.get(key)! }]);
    }
  }

  const valid = new Set(t.universe(p));
  const fail = (reason: string, line: string, part?: number): CheckResult => ({ ok: false, reason, detail: [`${where}: ${line}`], part });
  const firstPart = (key: string, sign: 1 | -1) => s.terms.findIndex((term) => term.sign === sign && runTerm(t, term, p).mult.has(key));
  for (const [key, c] of total) {
    if (!valid.has(key) && c > 0) return fail("This counts something that isn't allowed.", `it counts ${t.show(key, p)}.`, firstPart(key, 1));
  }
  for (const [key, c] of total) {
    if (valid.has(key) && c > 1) {
      const by = builtBy.get(key) ?? [];
      const how = by.length > 1 ? `in part ${by[0].part} and again in part ${by[1].part}` : `as ${by[0]?.paths.join("  and as  ")}`;
      return fail("Something is counted more than once.", `${t.show(key, p)} is counted ${c} times: ${how}.`, by.length > 1 ? by[1].part - 1 : (by[0]?.part ?? 1) - 1);
    }
  }
  for (const key of valid) {
    const c = total.get(key) ?? 0;
    if (c < 1) return fail("Something valid is never counted.", `${t.show(key, p)} is missed.`, firstPart(key, -1) >= 0 ? firstPart(key, -1) : undefined);
  }
  for (const [key, c] of total) {
    if (c < 0) return fail("This subtracts something that was never counted.", `${t.show(key, p)} is subtracted without being counted first.`, firstPart(key, -1));
  }
  const value = structValue(card, s);
  if (value !== card.answer) return { ok: false, reason: `This works for the smaller version but gives ${value} for the real one.`, detail: [] };
  return { ok: true };
}

// ---- moves ------------------------------------------------------------------
/**
 * The standing Module B toolbox: operation tokens that join pieces. The pieces themselves
 * (what a slot stands for, in words, never with its count) come from the problem, like the
 * terms of an expression do in Module A.
 */
export const STRUCT_MOVES: MoveDef[] = [
  {
    id: "slot", name: "× Multiply", group: "build", blurb: "Add a slot for one more independent choice; drop a piece into it and type how many options it has.",
    params: [{ name: "slot", label: "Piece", kind: "term" }, { name: "count", label: "Options", kind: "int" }],
    kind: "Add a slot for the next choice", goal: "Count the choices for the next position", why: "Independent choices in a row multiply.",
  },
  {
    id: "case", name: "+ Case", group: "join", blurb: "Start a separate case. Cases are added, so they must not overlap.", params: [],
    kind: "Split into cases", goal: "Break the count into separate situations", why: "Separate, non-overlapping cases add.",
  },
  {
    id: "subtract", name: "− Overcount", group: "join", blurb: "Start a part that is subtracted: what was counted but shouldn't be.", params: [],
    kind: "Subtract an overcount", goal: "Remove what was counted too often", why: "What was counted wrongly is taken away again.",
  },
  {
    id: "complement", name: "− Complement", group: "join", blurb: "Everything, minus the ones you don't want.", params: [],
    kind: "Count the complement", goal: "Count the opposite and take it away from everything", why: "Wanted = everything − unwanted.",
  },
  {
    id: "divide", name: "÷ Symmetry", group: "join", blurb: "Divide a part by how many times it builds each outcome.", params: [{ name: "value", label: "Divide by", kind: "int" }],
    kind: "Divide by symmetry", goal: "Fix the fact that each outcome was built several times", why: "If every outcome is built the same number of times, dividing gives each one once.",
  },
  {
    id: "check", name: "Check", blurb: "Verify against a brute-force count.", params: [], gesture: true,
    kind: "Check the structure", goal: "Check your structure", why: "The structure builds every valid outcome exactly once.",
  },
];

/** A count typed on the keypad: digits, ! and × (e.g. "24", "4!", "2×4!"). */
export function parseCount(src: string): number | null {
  const parts = src.replace(/\s/g, "").replace(/[x*·]/g, "×").split("×");
  if (!parts.length || parts.some((x) => !/^\d+!?$/.test(x))) return null;
  const fact = (n: number): number => (n <= 1 ? 1 : n * fact(n - 1));
  const value = parts.reduce((prod, x) => prod * (x.endsWith("!") ? (Number(x.slice(0, -1)) <= 12 ? fact(Number(x.slice(0, -1))) : NaN) : Number(x)), 1);
  return Number.isFinite(value) ? value : null;
}

const last = (s: StructState) => s.terms[s.terms.length - 1];

export function applyStructMove(card: StructCard, s: StructState, move: string, params: Record<string, string> = {}): ApplyResult<StructState> {
  const t = template(card.template);
  const cur = last(s);
  const startPart = (sign: 1 | -1, why: string): ApplyResult<StructState> => {
    if (!cur || !cur.slots.length) return { ok: false, reason: "Fill the current part first.", noop: true };
    return { ok: true, state: { terms: [...s.terms, { sign, slots: [], div: null }] }, why };
  };
  switch (move) {
    case "slot": {
      if (!card.palette.includes(params.slot ?? "")) return { ok: false, reason: "Drop a piece into the slot.", noop: true };
      const slot = slotOf(t, params.slot);
      const placed = cur?.slots.length ?? 0;
      const actual = slot.count(card.full, placed);
      // The count is the student's: it is checked here, never shown on the piece.
      if (params.count !== undefined) {
        const typed = parseCount(params.count);
        if (typed === null) return { ok: false, reason: "Type a whole number (you can use ! and ×).", noop: true };
        if (typed !== actual) {
          const reason =
            placed > 0 && typed === slot.count(card.full, 0) && actual !== typed
              ? "That's how many there were at the start, but the earlier slots have used some up."
              : typed > actual
                ? `Too many: "${slot.label(card.full)}" doesn't leave ${typed} choices here.`
                : `Too few: count every choice "${slot.label(card.full)}" still allows here.`;
          return { ok: false, reason };
        }
      }
      const terms = cur ? [...s.terms.slice(0, -1), { ...cur, slots: [...cur.slots, params.slot] }] : [{ sign: 1 as const, slots: [params.slot], div: null }];
      const why = placed > 0 && actual < slot.count(card.full, 0) ? `${actual} options: the earlier slots used ${slot.count(card.full, 0) - actual} up.` : `${actual} options, independent of the other slots.`;
      return { ok: true, state: { terms }, why };
    }
    case "case":
      return startPart(1, "A new case: it is added to the others, so it must not overlap them.");
    case "subtract":
      return startPart(-1, "A part that is taken away.");
    case "complement":
      return startPart(-1, "Now build the outcomes you don't want; they're subtracted from everything.");
    case "divide": {
      if (!cur || !cur.slots.length) return { ok: false, reason: "Add the slots before dividing.", noop: true };
      let id = params.div ?? "";
      if (!id && params.value !== undefined) {
        const v = parseCount(params.value);
        if (v === null || v < 2) return { ok: false, reason: "Divide by a whole number bigger than 1.", noop: true };
        id = card.divs.find((d) => divOf(t, d).value(card.full) === v) ?? `lit:${v}`;
      }
      if (!id || (!id.startsWith("lit:") && !card.divs.includes(id))) return { ok: false, reason: "Type what to divide by.", noop: true };
      return { ok: true, state: { terms: [...s.terms.slice(0, -1), { ...cur, div: id }] }, why: "Divided: Check will test that every outcome really is built that many times." };
    }
    case "check": {
      const r = checkStructure(card, s);
      if (r.ok) return { ok: true, state: s, done: true, why: "Every valid outcome is counted exactly once." };
      // A typed divisor can match two symmetries with the same value on the real problem.
      // The student only typed a number, so any reading consistent with it counts.
      for (const alt of divisorReadings(card, s)) if (checkStructure(card, alt).ok) return { ok: true, state: alt, done: true, why: "Every valid outcome is counted exactly once." };
      return r;
    }
    default:
      return { ok: false, reason: "Unknown move." };
  }
}

/** Other structures the same typed divisors could stand for (same value on the real problem). */
function divisorReadings(card: StructCard, s: StructState): StructState[] {
  const t = template(card.template);
  const options = s.terms.map((term) => {
    if (!term.div) return [null];
    const v = divOf(t, term.div).value(card.full);
    return [...new Set([term.div, ...card.divs.filter((d) => divOf(t, d).value(card.full) === v)])];
  });
  let combos: (string | null)[][] = [[]];
  for (const o of options) combos = combos.flatMap((c) => o.map((x) => [...c, x])).slice(0, 32);
  return combos.slice(1).map((divs) => ({ terms: s.terms.map((term, i) => ({ ...term, div: divs[i] })) }));
}

export const structModule: EngineModule<StructState, StructCard> = {
  id: "struct",
  init: () => ({ terms: [] }),
  toolbox: () => STRUCT_MOVES.filter((m) => !m.gesture),
  moveDef: (id) => STRUCT_MOVES.find((m) => m.id === id),
  apply: (card, state, input) => applyStructMove(card, state, input.move, input.params),
  // Only an explicit "check" move ends a structure card.
  isGoal: (card, state) => checkStructure(card, state).ok,
  show: (state, card) => showStruct(card, state),
  answer: (card) => String(card.answer),
};

/** The problem's pieces: what each slot can stand for, in words only. */
export function structPieces(card: StructCard): { id: string; label: string }[] {
  const t = template(card.template);
  return card.palette.map((id) => ({ id, label: slotOf(t, id).label(card.full) }));
}

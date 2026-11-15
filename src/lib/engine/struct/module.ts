// Module B (structures): the student builds a count out of slots, case splits and
// operations. The verifier does not compare numbers: it ENUMERATES what the structure
// actually builds on a scaled-down version of the problem and compares that, outcome by
// outcome, with a brute-force list of the valid outcomes. A mismatch therefore comes with
// a concrete counterexample: an arrangement built twice, never built, or not allowed.
import type { ApplyResult, CardBase, EngineModule, MoveDef, MoveOption } from "../types";

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
const divOf = (t: StructTemplate, id: string) => {
  const d = t.divisors.find((x) => x.id === id);
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

export type CheckResult = { ok: true } | { ok: false; reason: string; detail: string[] };

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
          reason: `Dividing by ${term.div ? divOf(t, term.div).value(card.full) : d} assumes every outcome was built exactly that many times.`,
          detail: [`${where}: ${t.show(key, p)} was built ${m} time${m === 1 ? "" : "s"}, not ${d} (e.g. ${run.paths.get(key)!.join("  and  ")}).`],
        };
      }
      total.set(key, (total.get(key) ?? 0) + (term.sign * m) / d);
      if (term.sign > 0) builtBy.set(key, [...(builtBy.get(key) ?? []), { part: i + 1, paths: run.paths.get(key)! }]);
    }
  }

  const valid = new Set(t.universe(p));
  const fail = (reason: string, line: string): CheckResult => ({ ok: false, reason, detail: [`${where}: ${line}`] });
  for (const [key, c] of total) {
    if (!valid.has(key) && c > 0) return fail("This counts something that isn't allowed.", `it counts ${t.show(key, p)}.`);
  }
  for (const [key, c] of total) {
    if (valid.has(key) && c > 1) {
      const by = builtBy.get(key) ?? [];
      const how = by.length > 1 ? `in part ${by[0].part} and again in part ${by[1].part}` : `as ${by[0]?.paths.join("  and as  ")}`;
      return fail("Something is counted more than once.", `${t.show(key, p)} is counted ${c} times: ${how}.`);
    }
  }
  for (const key of valid) {
    const c = total.get(key) ?? 0;
    if (c < 1) return fail("Something valid is never counted.", `${t.show(key, p)} is missed.`);
  }
  for (const [key, c] of total) {
    if (c < 0) return fail("This subtracts something that was never counted.", `${t.show(key, p)} is subtracted without being counted first.`);
  }
  const value = structValue(card, s);
  if (value !== card.answer) return { ok: false, reason: `This works for the smaller version but gives ${value} for the real one.`, detail: [] };
  return { ok: true };
}

// ---- moves ------------------------------------------------------------------
export const STRUCT_MOVES: MoveDef[] = [
  { id: "slot", name: "Multiply: add a slot", aliases: ["multiply", "slot", "times", "multiplication principle", "next choice"], blurb: "One more independent choice.", params: [{ name: "slot", label: "Which choice?", kind: "choice" }] },
  { id: "case", name: "Split into cases (add)", aliases: ["cases", "casework", "add", "new case"], blurb: "Start a separate case; cases are added.", params: [] },
  { id: "subtract", name: "Subtract an overcount", aliases: ["subtract", "remove overcount", "take away"], blurb: "Start a part that is subtracted.", params: [] },
  { id: "complement", name: "Complement: everything minus the ones you don't want", aliases: ["complement", "total minus", "at least one", "complementary counting"], blurb: "Count everything, then subtract the outcomes with none.", params: [] },
  { id: "divide", name: "Divide by symmetry", aliases: ["divide", "symmetry", "unordered", "overcounted orders"], blurb: "Each outcome was built the same number of times.", params: [{ name: "div", label: "Divide by", kind: "choice" }] },
  { id: "check", name: "Check the structure", blurb: "Verify against a brute-force count.", params: [] },
];

const last = (s: StructState) => s.terms[s.terms.length - 1];

export function applyStructMove(card: StructCard, s: StructState, move: string, params: Record<string, string> = {}): ApplyResult<StructState> {
  const t = template(card.template);
  const cur = last(s);
  const startPart = (sign: 1 | -1): ApplyResult<StructState> => {
    if (!cur || !cur.slots.length) return { ok: false, reason: "Fill the current part first.", noop: true };
    return { ok: true, state: { terms: [...s.terms, { sign, slots: [], div: null }] } };
  };
  switch (move) {
    case "slot": {
      if (!card.palette.includes(params.slot ?? "")) return { ok: false, reason: "Pick a slot.", noop: true };
      slotOf(t, params.slot);
      const terms = cur ? [...s.terms.slice(0, -1), { ...cur, slots: [...cur.slots, params.slot] }] : [{ sign: 1 as const, slots: [params.slot], div: null }];
      return { ok: true, state: { terms } };
    }
    case "case":
      return startPart(1);
    case "subtract":
    case "complement":
      return startPart(-1);
    case "divide": {
      if (!card.divs.includes(params.div ?? "")) return { ok: false, reason: "Pick what to divide by.", noop: true };
      if (!cur || !cur.slots.length) return { ok: false, reason: "Add the slots before dividing.", noop: true };
      return { ok: true, state: { terms: [...s.terms.slice(0, -1), { ...cur, div: params.div }] } };
    }
    case "check": {
      const r = checkStructure(card, s);
      return r.ok ? { ok: true, state: s, done: true } : r;
    }
    default:
      return { ok: false, reason: "Unknown move." };
  }
}

export const structModule: EngineModule<StructState, StructCard> = {
  id: "struct",
  init: () => ({ terms: [] }),
  options(card, state) {
    const t = template(card.template);
    const placed = last(state)?.slots.length ?? 0;
    const out: MoveOption[] = card.palette.map((id) => {
      const slot = slotOf(t, id);
      return { key: `slot:${id}`, move: "slot", label: `× ${slot.count(card.full, placed)}`, hint: slot.label(card.full), preset: { slot: id } };
    });
    for (const id of card.divs) {
      const d = divOf(t, id);
      out.push({ key: `divide:${id}`, move: "divide", label: `÷ ${d.value(card.full)}`, hint: d.label(card.full), preset: { div: id } });
    }
    out.push({ key: "case", move: "case", label: "+ new case", hint: "Start a separate case (added)" });
    out.push({ key: "complement", move: "complement", label: "− complement", hint: "Everything, minus the ones you don't want" });
    out.push({ key: "subtract", move: "subtract", label: "− overcount", hint: "Subtract what was counted too often" });
    return out;
  },
  moveDef: (_card, id) => STRUCT_MOVES.find((m) => m.id === id),
  apply: (card, state, input) => applyStructMove(card, state, input.move, input.params),
  // Only an explicit "check" move ends a structure card.
  isGoal: (card, state) => checkStructure(card, state).ok,
  show: (state, card) => showStruct(card, state),
  answer: (card) => String(card.answer),
  optionKey: (input) => (input.move === "slot" ? `slot:${input.params?.slot}` : input.move === "divide" ? `divide:${input.params?.div}` : input.move),
};

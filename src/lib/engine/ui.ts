// Pure helpers behind the workspace: what each support level shows, the hint ladder,
// and plain-text descriptions of steps. Nothing here ever builds a list of candidate
// moves or answers: support is a highlight on the student's own workspace, a name for
// the kind of step, or (last hint rung) the step itself.
import { parseExpr, show } from "./expr/ast";
import { defaultTarget } from "./expr/module";
import type { ExprState } from "./expr/state";
import { moduleOf, nextReferenceStep, replay, type Card } from "./registry";
import { divOf, structPieces, template } from "./struct/module";
import type { MoveInput } from "./types";

export type Level = 1 | 2 | 3;

/** What to light up on the workspace. Module A: a branch, a side, some of its parts. Module B: a piece / tile. */
export interface Highlight {
  eq?: number;
  side?: "lhs" | "rhs";
  /** Top-level terms/factors of that side; absent = the whole side (or line). */
  parts?: number[];
  /** Module B: the piece (slot meaning) to drag next. */
  piece?: string;
  /** A tile of the standing toolbox. */
  tile?: string;
}
export interface Guide {
  text: string;
  highlight?: Highlight;
}

const pretty = (v: string) => {
  try {
    return show(parseExpr(v));
  } catch {
    return v;
  }
};

/** Where a step acts, for highlighting. */
export function stepHighlight<S>(card: Card, state: S, step: MoveInput): Highlight {
  const mod = moduleOf(card);
  const def = mod.moveDef(step.move);
  const tile = def && !def.gesture ? step.move : undefined;
  if (card.module === "struct") return { piece: step.move === "slot" ? step.params?.slot : undefined, tile: step.move === "slot" ? undefined : tile };
  const t = step.target ?? defaultTarget(state as ExprState);
  const parts =
    t.part !== undefined ? [t.part]
    : step.move === "combine" ? [Number(step.params?.i), Number(step.params?.j)]
    : step.move === "move_across" || step.move === "reorder" ? [Number(step.params?.i)]
    : undefined;
  return { eq: t.eq, side: t.side, parts, tile };
}

/** "Factor out a common term: 3x" · "× 4: any runner not used yet" */
export function describeStep<S>(card: Card, state: S, step: MoveInput): string {
  const mod = moduleOf(card);
  const def = mod.moveDef(step.move);
  if (card.module === "struct") {
    const t = template(card.template);
    if (step.move === "slot") {
      const piece = structPieces(card).find((p) => p.id === step.params?.slot);
      const placed = (state as { terms: { slots: string[] }[] }).terms.at(-1)?.slots.length ?? 0;
      const count = t.slots.find((s) => s.id === step.params?.slot)?.count(card.full, placed);
      return `× ${count}: ${piece?.label ?? step.params?.slot}`;
    }
    if (step.move === "divide") {
      const v = step.params?.div ? divOf(t, step.params.div).value(card.full) : step.params?.value;
      const label = step.params?.div && !step.params.div.startsWith("lit:") ? divOf(t, step.params.div).label(card.full) : "";
      return `÷ ${v}${label ? `: ${label}` : ""}`;
    }
    return def?.name ?? step.move;
  }
  if (step.move === "combine" || step.move === "move_across" || step.move === "reorder") {
    const s = state as ExprState;
    const t = step.target ?? defaultTarget(s);
    const side = s.kind === "eqs" ? (t.side === "rhs" ? s.eqs[t.eq ?? 0].rhs : s.eqs[t.eq ?? 0].lhs) : s.kind === "expr" ? s.expr : null;
    const terms = side ? (side.k === "add" ? side.terms : [side]) : [];
    const name = (i: string | undefined) => (terms[Number(i)] ? show(terms[Number(i)]) : "?");
    if (step.move === "combine") return `Combine ${name(step.params?.i)} and ${name(step.params?.j)}`;
    if (step.move === "move_across") return `Move ${name(step.params?.i)} across the = sign`;
    return `Move ${name(step.params?.i)} to position ${Number(step.params?.to) + 1}`;
  }
  const values = def?.params.map((p) => {
    const raw = step.params?.[p.name] ?? "";
    if (p.kind === "toggle") return raw === p.off ? `${p.label}: off` : "";
    return pretty(raw);
  }).filter(Boolean);
  return `${def?.name ?? step.move}${values?.length ? `: ${values.join(", ")}` : ""}`;
}

/** The whole problem's goal: the only support shown at Level 3. */
export function problemGoal(card: Card): string {
  if (card.module === "struct") return "Build a structure that counts every outcome exactly once.";
  switch (card.goal.type) {
    case "factored": return "Goal: a product of factors that can't be factored further.";
    case "solved": return "Goal: every branch reads x = a number.";
    case "form": return "Goal: the form (x + h)² + k.";
    case "residue": return "Goal: a single remainder.";
  }
}

const OFF_ROUTE = "You've left the guided route. That's allowed: keep going, or Undo to get guidance back.";

/**
 * Fading support. Level 1: highlight exactly where the next step applies and name the kind
 * of step. Level 2: only the goal of the step. Level 3: nothing beyond the problem's goal.
 */
export function guidance<S>(card: Card, state: S, line: string, level: Level): Guide | null {
  if (level === 3) return null;
  const next = nextReferenceStep(card, line);
  if (!next) return { text: OFF_ROUTE };
  const def = moduleOf(card).moveDef(next.move);
  if (!def) return null;
  if (level === 2) return { text: def.goal };
  return { text: def.kind, highlight: stepHighlight(card, state, next) };
}

/** Hint ladder: 1 = highlight the relevant part, 2 = name the kind of step, 3 = show the step. */
export function hint<S>(card: Card, state: S, line: string, rung: 1 | 2 | 3): Guide {
  const next = nextReferenceStep(card, line);
  if (!next) {
    const first = card.path[0];
    return rung < 3 ? { text: OFF_ROUTE } : { text: `From the start, the shortest route begins: ${describeStep(card, moduleOf(card).init(card), first)}.` };
  }
  const def = moduleOf(card).moveDef(next.move);
  const highlight = stepHighlight(card, state, next);
  if (rung === 1) return { text: `Look at the highlighted part. ${card.nudge}`, highlight: { ...highlight, tile: undefined } };
  if (rung === 2) return { text: `Kind of step: ${def?.kind ?? next.move}.`, highlight };
  if (next.move === "check") return { text: "The structure is complete. Check it.", highlight };
  return { text: `Do this: ${describeStep(card, state, next)}.`, highlight };
}

export interface PathLine { step: string | null; line: string; key: boolean }
/** The reference path as printable lines (start, then each step and what it produces). */
export function referenceLines(card: Card): PathLine[] {
  const mod = moduleOf(card);
  const lines = replay(card).lines;
  let state = mod.init(card);
  const out: PathLine[] = card.module === "expr" ? [{ step: null, line: lines[0], key: false }] : [];
  card.path.forEach((step, i) => {
    const text = describeStep(card, state, step);
    const r = mod.apply(card, state, step);
    if (r.ok) state = r.state;
    if (step.move !== "check") out.push({ step: text, line: lines[i + 1] ?? "", key: card.keyMoves.includes(step.move) });
  });
  return out;
}

export function keyMoveName(card: Card): string {
  const mod = moduleOf(card);
  const used = card.path.find((s) => card.keyMoves.includes(s.move))?.move ?? card.keyMoves[0];
  return mod.moveDef(used)?.name ?? used;
}

/** The step the student didn't manage, for the mistakes log. */
export function failedStep(card: Card, line: string, stepsDone: number): string {
  const next = nextReferenceStep(card, line);
  if (!next) return `Left the shortest route after step ${stepsDone}`;
  const mod = moduleOf(card);
  let state = mod.init(card);
  for (const step of card.path) {
    if (mod.show(state, card) === line) break;
    const r = mod.apply(card, state, step);
    if (!r.ok) break;
    state = r.state;
  }
  return `Step ${stepsDone + 1}: ${describeStep(card, state, next)}`;
}

/** The full problem as text, for the mistakes log. */
export function problemText(card: Card): string {
  return card.module === "expr" ? `${card.prompt} ${replay(card).lines[0]}` : card.prompt;
}

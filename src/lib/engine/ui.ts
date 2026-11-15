// Pure helpers behind the card screen: which moves to offer at each scaffolding level,
// matching a typed move name, the hint ladder, and plain-text descriptions of steps.
import { parseExpr, show } from "./expr/ast";
import { moduleOf, nextReferenceStep, replay, type Card } from "./registry";
import { STRUCT_MOVES } from "./struct/module";
import type { MoveDef, MoveInput, MoveOption } from "./types";

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function shuffled<T>(xs: T[], seed: string): T[] {
  return xs.map((x, i) => [hash(`${seed}:${i}`), x] as const).sort((a, b) => a[0] - b[0]).map(([, x]) => x);
}

/**
 * Level 1: a menu of 4 candidate moves (the reference next move plus 3 distractors).
 * Levels 2 and 3: every move in the pack (level 3 hides the list until a move is named).
 */
export function menuOptions<S>(card: Card, state: S, line: string, level: 1 | 2 | 3): MoveOption[] {
  const mod = moduleOf(card);
  const all = mod.options(card, state);
  if (level !== 1 || all.length <= 4) return all;
  const next = nextReferenceStep(card, line);
  const correct = (next && all.find((o) => o.key === mod.optionKey(next))) || all.find((o) => card.keyMoves.includes(o.move));
  const others = shuffled(all.filter((o) => o !== correct), card.id + line);
  const pickN = correct ? 3 : 4;
  return shuffled([...(correct ? [correct] : []), ...others.slice(0, pickN)], line + card.id);
}

/** The moves a student can name at level 3 from this line. */
export function moveDefs<S>(card: Card, state: S): MoveDef[] {
  if (card.module === "struct") return STRUCT_MOVES.filter((m) => m.id !== "check");
  const mod = moduleOf(card);
  return mod.options(card, state).flatMap((o) => mod.moveDef(card, o.move) ?? []);
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
/** Level 3: the student names the move. A unique match on the name or an alias selects it. */
export function matchMove(defs: MoveDef[], typed: string): { move: MoveDef } | { error: string } {
  const q = norm(typed);
  if (q.length < 3) return { error: "Type a bit more of the move's name." };
  const score = (m: MoveDef) => {
    const names = [m.name, ...(m.aliases ?? [])].map(norm);
    if (names.includes(q)) return 3;
    if (names.some((n) => n.startsWith(q))) return 2;
    return names.some((n) => n.includes(q) || (q.includes(n) && n.length >= 4)) ? 1 : 0;
  };
  const ranked = defs.map((m) => ({ m, s: score(m) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
  if (!ranked.length) return { error: "No move by that name here. Try another name for it." };
  if (ranked.length > 1 && ranked[0].s === ranked[1].s) return { error: "That could be more than one move. Be more specific." };
  return { move: ranked[0].m };
}

const pretty = (v: string) => {
  try {
    return show(parseExpr(v));
  } catch {
    return v;
  }
};
/** "Factor out a common term: 3x" · "× 5 — any runner not used yet" */
export function describeStep<S>(card: Card, state: S, step: MoveInput): string {
  const mod = moduleOf(card);
  if (card.module === "struct") {
    if (step.move === "check") return "Check the structure";
    const opt = mod.options(card, state).find((o) => o.key === mod.optionKey(step));
    return opt ? `${opt.label} — ${opt.hint}` : step.move;
  }
  const def = mod.moveDef(card, step.move);
  const values = def?.params.map((p) => {
    const raw = step.params?.[p.name] ?? "";
    return p.kind === "choice" ? (p.options?.find((o) => o.value === raw)?.label ?? raw) : pretty(raw);
  });
  return `${def?.name ?? step.move}${values?.length ? `: ${values.join(", ")}` : ""}`;
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

/** Hint ladder: 1 = nudge, 2 = names the next move, 3 = the full next step. */
export function hintText<S>(card: Card, state: S, line: string, rung: 1 | 2 | 3): string {
  if (rung === 1) return card.nudge;
  const mod = moduleOf(card);
  const next = nextReferenceStep(card, line);
  if (!next) {
    const first = card.path[0];
    const from = mod.init(card);
    return rung === 2
      ? `You've left the shortest path. Undo, or start again with: ${mod.moveDef(card, first.move)?.name ?? first.move}.`
      : `From the start: ${describeStep(card, from, first)}.`;
  }
  if (next.move === "check") return "The structure is complete. Check it.";
  return rung === 2 ? `Next move: ${mod.moveDef(card, next.move)?.name ?? next.move}.` : `Do this: ${describeStep(card, state, next)}.`;
}

export function keyMoveName(card: Card): string {
  const mod = moduleOf(card);
  const used = card.path.find((s) => card.keyMoves.includes(s.move))?.move ?? card.keyMoves[0];
  return mod.moveDef(card, used)?.name ?? used;
}

/** The full problem as text, for the mistakes log. */
export function problemText(card: Card): string {
  return card.module === "expr" ? `${card.prompt} ${replay(card).lines[0]}` : card.prompt;
}

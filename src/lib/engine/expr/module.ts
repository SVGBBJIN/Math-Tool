// Module A (expressions) wired into the common shell.
import { evaluate, parseExpr, show, varsOf, type Expr } from "./ast";
import { applyExprMove, EXPR_TOOLBOX, exprMove } from "./moves";
import { parseState, showState, type ExprState, type Target } from "./state";
import type { CardBase, EngineModule } from "../types";

export type ExprGoal =
  | { type: "factored"; final: string } // same factors as `final`, in any order
  | { type: "solved"; solutions: string[] } // every branch reads "x = value"
  | { type: "form"; final: string } // exactly this form, e.g. (x + 3)² − 2
  | { type: "residue"; value: number };

export interface ExprCard extends CardBase {
  module: "expr";
  start: string;
  goal: ExprGoal;
}

const PROBES = [0.371, 1.618, -2.236, 3.1416, -0.577, 4.669];
function proportional(f: Expr, g: Expr): boolean {
  const names = [...new Set([...varsOf(f), ...varsOf(g)])];
  return PROBES.every((x) => {
    const env = Object.fromEntries(names.map((n, i) => [n, x + 0.83 * i]));
    const r = evaluate(f, env) / evaluate(g, env);
    return Math.abs(Math.abs(r) - 1) < 1e-7;
  });
}
/** Non-constant factors, with powers written out, plus the numeric constant in front. */
function factors(e: Expr): { c: number; fs: Expr[] } {
  const out = { c: 1, fs: [] as Expr[] };
  const walk = (x: Expr) => {
    if (x.k === "mul") x.factors.forEach(walk);
    else if (x.k === "neg") {
      out.c *= -1;
      walk(x.arg);
    } else if (x.k === "pow") for (let i = 0; i < x.exp; i++) walk(x.base);
    else if (!varsOf(x).size) out.c *= evaluate(x, {});
    else out.fs.push(x);
  };
  walk(e);
  return out;
}
function sameFactors(a: Expr, b: Expr): boolean {
  const fa = factors(a).fs;
  const rest = [...factors(b).fs];
  if (fa.length !== rest.length) return false;
  for (const f of fa) {
    const i = rest.findIndex((g) => proportional(f, g));
    if (i < 0) return false;
    rest.splice(i, 1);
  }
  return true;
}

const isSolvedEq = (e: { lhs: Expr; rhs: Expr }) => e.lhs.k === "var" && !varsOf(e.rhs).size;

export function exprGoalReached(goal: ExprGoal, s: ExprState): boolean {
  if (s.kind !== "mod" && s.sub) return false;
  switch (goal.type) {
    case "factored":
      return s.kind === "expr" && sameFactors(s.expr, parseExpr(goal.final));
    case "form":
      return showState(s) === showState(parseState(goal.final));
    case "residue":
      return s.kind === "mod" && s.expr.k === "num" && s.expr.d === 1 && s.expr.n === goal.value;
    case "solved": {
      if (s.kind !== "eqs" || !s.eqs.every(isSolvedEq)) return false;
      const got = s.eqs.map((e) => evaluate(e.rhs, {}));
      const want = goal.solutions.map((x) => evaluate(parseExpr(x), {}));
      const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
      return got.length === want.length && want.every((w) => got.some((g) => near(g, w))) && got.every((g) => want.some((w) => near(g, w)));
    }
  }
}

/** The piece a move acts on when the student hasn't tapped one: the first unsolved branch. */
export function defaultTarget(s: ExprState): Target {
  if (s.kind !== "eqs") return {};
  const i = s.eqs.findIndex((e) => !isSolvedEq(e));
  return { eq: Math.max(0, i), side: "lhs" };
}

export const exprModule: EngineModule<ExprState, ExprCard> = {
  id: "expr",
  init: (card) => parseState(card.start),
  toolbox: () => EXPR_TOOLBOX,
  moveDef: (id) => exprMove(id),
  apply(card, state, input) {
    const r = applyExprMove(state, input.move, input.params, input.target ?? defaultTarget(state));
    return r.ok ? { ...r, done: exprGoalReached(card.goal, r.state) } : r;
  },
  isGoal: (card, state) => exprGoalReached(card.goal, state),
  show: (state) => showState(state),
  answer(card) {
    const g = card.goal;
    if (g.type === "factored" || g.type === "form") return showState(parseState(g.final));
    if (g.type === "residue") return String(g.value);
    const start = parseState(card.start);
    const name = start.kind === "eqs" ? ([...varsOf(start.eqs[0].lhs), ...varsOf(start.eqs[0].rhs)][0] ?? "x") : "x";
    return g.solutions.map((x) => `${name} = ${show(parseExpr(x))}`).join("  or  ");
  },
};

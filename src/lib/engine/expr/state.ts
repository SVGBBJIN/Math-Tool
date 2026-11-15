// Module A state: an expression, a set of equations joined by "or", or a congruence.
import { add, mul, parseExpr, show, type Expr } from "./ast";

export interface Eq { lhs: Expr; rhs: Expr }
/** Active substitution: `name` stands for `expr` (e.g. u = x²). */
export interface Sub { name: string; expr: Expr }

export type ExprState =
  | { kind: "expr"; expr: Expr; sub?: Sub }
  | { kind: "eqs"; eqs: Eq[]; sub?: Sub }
  | { kind: "mod"; expr: Expr; mod: number };

/** Which piece a move acts on: a branch, a side of it, and optionally one top-level factor/term. */
export interface Target { eq?: number; side?: "lhs" | "rhs"; part?: number }

/** "x^2+7x+12" · "x^2-5x+6 = 0" · "x = 2 or x = 3" · "7^2026 mod 10" */
export function parseState(src: string): ExprState {
  const m = src.match(/^(.*)\bmod\s+(\d+)\s*$/);
  if (m) return { kind: "mod", expr: parseExpr(m[1]), mod: Number(m[2]) };
  if (src.includes("=")) {
    return {
      kind: "eqs",
      eqs: src.split(/\bor\b/).map((part) => {
        const [l, r] = part.split("=");
        return { lhs: parseExpr(l), rhs: parseExpr(r) };
      }),
    };
  }
  return { kind: "expr", expr: parseExpr(src) };
}

export function showState(s: ExprState): string {
  const tail = "sub" in s && s.sub ? `   [${s.sub.name} = ${show(s.sub.expr)}]` : "";
  if (s.kind === "expr") return show(s.expr) + tail;
  if (s.kind === "mod") return `${show(s.expr)}  (mod ${s.mod})`;
  return s.eqs.map((e) => `${show(e.lhs)} = ${show(e.rhs)}`).join("  or  ") + tail;
}

/** Top-level pieces a student can tap: factors of a product or terms of a sum. */
export function partsOf(e: Expr): Expr[] {
  return e.k === "mul" ? e.factors : e.k === "add" ? e.terms : [];
}

export function sideOf(s: ExprState, t: Target): Expr {
  if (s.kind !== "eqs") return s.expr;
  const eq = s.eqs[t.eq ?? 0];
  if (!eq) throw new Error("No such equation");
  return t.side === "rhs" ? eq.rhs : eq.lhs;
}
export function getTarget(s: ExprState, t: Target): Expr {
  const side = sideOf(s, t);
  if (t.part === undefined) return side;
  const part = partsOf(side)[t.part];
  if (!part) throw new Error("No such part");
  return part;
}
/** New state with the targeted piece replaced. Products and sums absorb the replacement. */
export function setTarget(s: ExprState, t: Target, next: Expr): ExprState {
  const side = sideOf(s, t);
  let whole = next;
  if (t.part !== undefined) {
    const parts = [...partsOf(side)];
    parts[t.part] = next;
    whole = side.k === "mul" ? mul(parts.flatMap((p) => (p.k === "mul" ? p.factors : [p])), true) : add(parts.flatMap((p) => (p.k === "add" ? p.terms : [p])), true);
  }
  if (s.kind !== "eqs") return { ...s, expr: whole };
  const i = t.eq ?? 0;
  return { ...s, eqs: s.eqs.map((e, j) => (j !== i ? e : t.side === "rhs" ? { ...e, rhs: whole } : { ...e, lhs: whole })) };
}

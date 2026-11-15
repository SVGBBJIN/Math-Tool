// Module A moves: named rewrite rules. A move BUILDS a candidate next line from the
// student's parameters (which factor, which two numbers...); verify.ts then decides by
// computation whether that line is equivalent to the previous one. A wrong parameter
// therefore produces a real, checkable wrong line, not a canned "incorrect".
import { add, evaluate, evaluateMod, mul, neg, num, parseExpr, pow, replace, show, sqrt, v, varsOf, type Expr } from "./ast";
import {
  coeffs, content, expsOf, fDiv, fNeg, fr, fromPoly, keyOf, pAdd, pAsConst, pDivExact, pEq, pScale, pSub, pVars, tryPoly,
  type Frac, type Poly,
} from "./poly";
import { getTarget, setTarget, showState, sideOf, type Eq, type ExprState, type Target } from "./state";
import { verifyStep } from "./verify";
import type { ApplyResult, MoveDef } from "../types";

export class MoveError extends Error {}
type Params = Record<string, string>;

export interface ExprMove extends Omit<MoveDef, "kind" | "goal" | "why"> {
  kinds: ExprState["kind"][];
  build(s: ExprState, t: Target, p: Params): ExprState;
  /** A one-line reason the step is valid, using the student's own numbers. */
  confirm?(s: ExprState, t: Target, p: Params): string | undefined;
  /** A sharper one-line reason when the built line fails verification. */
  explain?(s: ExprState, t: Target, p: Params, fallback: string): string | undefined;
}

// ---- parameter + shape helpers ----------------------------------------------
function int(p: Params, name: string): number {
  const s = (p[name] ?? "").trim().replace(/[−–]/g, "-");
  if (!/^[-+]?\d+$/.test(s)) throw new MoveError("Enter a whole number.");
  return Number(s);
}
function term(p: Params, name: string): Expr {
  try {
    return parseExpr(p[name] ?? "");
  } catch {
    throw new MoveError("Couldn't read that. Try something like 3x or x + 2.");
  }
}
function poly(e: Expr): Poly {
  const p = tryPoly(e);
  if (!p) throw new MoveError("This move works on polynomials.");
  return p;
}
function oneVar(e: Expr): string {
  const names = [...varsOf(e)];
  if (names.length !== 1) throw new MoveError("This move needs an expression in one variable.");
  return names[0];
}
const binomial = (x: string, c: number): Expr => (c === 0 ? v(x) : add([v(x), num(c)], true));
const termOf = (c: Frac, key: string): Expr => fromPoly(new Map([[key, c]]));
function eqAt(s: ExprState, t: Target): { eq: Eq; i: number; s: ExprState & { kind: "eqs" } } {
  if (s.kind !== "eqs") throw new MoveError("This move needs an equation.");
  const i = t.eq ?? 0;
  if (!s.eqs[i]) throw new MoveError("Pick an equation first.");
  return { eq: s.eqs[i], i, s };
}
const withEqs = (s: ExprState & { kind: "eqs" }, i: number, repl: Eq[]): ExprState => ({ ...s, eqs: [...s.eqs.slice(0, i), ...repl, ...s.eqs.slice(i + 1)] });
/** a x² + b x + c in one variable, integer or rational coefficients. */
function quadratic(e: Expr): { x: string; a: Frac; b: Frac; c: Frac } {
  const x = oneVar(e);
  const cs = coeffs(poly(e), x);
  if (!cs || cs.length !== 3) throw new MoveError("This move needs a quadratic like ax² + bx + c.");
  return { x, a: cs[2], b: cs[1], c: cs[0] };
}
const asInt = (f: Frac) => (f.d === 1 ? f.n : null);
const mapExprs = (s: ExprState, f: (e: Expr) => Expr): ExprState =>
  s.kind === "eqs" ? { ...s, eqs: s.eqs.map((e) => ({ lhs: f(e.lhs), rhs: f(e.rhs) })) } : { ...s, expr: f(s.expr) };

// ---- the moves ----------------------------------------------------------------
const EXPRISH: ExprState["kind"][] = ["expr", "eqs"];

const RAW_MOVES: ExprMove[] = [
  {
    id: "gcf",
    name: "Factor out a common term",
    blurb: "Pull out what every term shares.",
    params: [{ name: "f", label: "Factor to pull out", kind: "term", placeholder: "3x" }],
    kinds: EXPRISH,
    build(s, t, p) {
      const T = getTarget(s, t);
      const f = term(p, "f");
      const F = poly(f);
      const c = pAsConst(F);
      if (c && Math.abs(c.n) === 1 && c.d === 1) throw new MoveError("Factoring out 1 doesn't change anything.");
      const P = poly(T);
      const q = pDivExact(P, F);
      // Whole-number problems keep whole numbers: 3x is not a common factor of 4x² + 12x.
      const whole = (x: Poly) => [...x.values()].every((k) => k.d === 1);
      if (!q || (whole(P) && whole(F) && !whole(q))) throw new MoveError(`${show(f)} doesn't divide every term of ${show(T)}.`);
      return setTarget(s, t, mul([f, fromPoly(q)], true));
    },
  },
  {
    id: "diff_squares",
    name: "Difference of squares",
    blurb: "A² − B² = (A − B)(A + B).",
    params: [
      { name: "A", label: "A (so A² is the first square)", kind: "term", placeholder: "x" },
      { name: "B", label: "B", kind: "term", placeholder: "5" },
    ],
    kinds: EXPRISH,
    build(s, t, p) {
      const A = term(p, "A");
      const B = term(p, "B");
      return setTarget(s, t, mul([add([A, neg(B)]), add([A, B])], true));
    },
  },
  {
    id: "trinomial",
    name: "Factor x² + bx + c (sum and product)",
    blurb: "Find two numbers that add to b and multiply to c.",
    params: [
      { name: "p", label: "First number", kind: "int", placeholder: "3" },
      { name: "q", label: "Second number", kind: "int", placeholder: "4" },
    ],
    kinds: EXPRISH,
    build(s, t, p) {
      const x = oneVar(getTarget(s, t));
      return setTarget(s, t, mul([binomial(x, int(p, "p")), binomial(x, int(p, "q"))], true));
    },
    explain(s, t, p) {
      try {
        const { a, b, c } = quadratic(getTarget(s, t));
        const [P, Q] = [int(p, "p"), int(p, "q")];
        if (a.n !== 1 || a.d !== 1) return "This shortcut needs a leading coefficient of 1. Factor out a common term or split the middle term instead.";
        if (asInt(b) === null || asInt(c) === null) return undefined;
        return `${P} + ${Q} = ${P + Q} and ${P}·${Q} = ${P * Q}; you need sum ${b.n} and product ${c.n}.`.replace(/-/g, "−");
      } catch {
        return undefined;
      }
    },
  },
  {
    id: "split_middle",
    name: "Split the middle term",
    blurb: "Rewrite bx as px + qx with p·q = a·c.",
    params: [
      { name: "p", label: "First coefficient", kind: "int", placeholder: "6" },
      { name: "q", label: "Second coefficient", kind: "int", placeholder: "1" },
    ],
    kinds: EXPRISH,
    build(s, t, p) {
      const { x, a, c } = quadratic(getTarget(s, t));
      const [P, Q] = [int(p, "p"), int(p, "q")];
      if (P === 0 || Q === 0) throw new MoveError("Both pieces of the middle term must be non-zero.");
      const terms = [termOf(a, `${x}^2`), termOf(fr(P), `${x}^1`), termOf(fr(Q), `${x}^1`)];
      if (c.n !== 0) terms.push(termOf(c, ""));
      return setTarget(s, t, add(terms, true));
    },
    explain(s, t, p) {
      try {
        const { x, b } = quadratic(getTarget(s, t));
        const [P, Q] = [int(p, "p"), int(p, "q")];
        return `${P} + ${Q} = ${P + Q}, but the middle term is ${show(termOf(b, `${x}^1`))}.`.replace(/-/g, "−");
      } catch {
        return undefined;
      }
    },
  },
  {
    id: "group",
    name: "Factor by grouping",
    blurb: "Factor each pair of terms, then pull out the shared bracket.",
    params: [],
    kinds: EXPRISH,
    build(s, t) {
      const T = getTarget(s, t);
      if (T.k !== "add" || T.terms.length !== 4) throw new MoveError("Grouping needs four terms. Split the middle term first.");
      const P1 = poly(add(T.terms.slice(0, 2), true));
      const P2 = poly(add(T.terms.slice(2), true));
      const c1 = content(P1);
      const B1 = pDivExact(P1, c1)!;
      const c2 = pDivExact(P2, B1);
      if (!c2 || c2.size > 1) {
        const k2 = content(P2);
        throw new MoveError(
          `The pairs give ${show(mul([fromPoly(c1), fromPoly(B1)], true))} and ${show(mul([fromPoly(k2), fromPoly(pDivExact(P2, k2)!)], true))}: no shared bracket.`,
        );
      }
      return setTarget(s, t, mul([fromPoly(pAdd(c1, c2)), fromPoly(B1)], true));
    },
  },
  {
    id: "perfect_square",
    name: "Perfect-square trinomial",
    blurb: "A² + 2AB + B² = (A + B)².",
    params: [
      { name: "A", label: "A", kind: "term", placeholder: "x" },
      { name: "B", label: "B (may be negative)", kind: "term", placeholder: "3" },
    ],
    kinds: EXPRISH,
    build(s, t, p) {
      return setTarget(s, t, pow(add([term(p, "A"), term(p, "B")]), 2));
    },
  },
  {
    id: "expand",
    name: "Expand (multiply out)",
    blurb: "Multiply everything out and collect like terms.",
    params: [],
    kinds: EXPRISH,
    build(s, t) {
      return setTarget(s, t, fromPoly(poly(getTarget(s, t))));
    },
  },
  {
    id: "complete_square",
    name: "Complete the square",
    blurb: "Rewrite x² + bx + c as (x + h)² + k.",
    params: [
      { name: "h", label: "h", kind: "int", placeholder: "3" },
      { name: "k", label: "k", kind: "int", placeholder: "-2" },
    ],
    kinds: ["expr"],
    build(s, t, p) {
      const x = oneVar(getTarget(s, t));
      const k = int(p, "k");
      const sq = pow(binomial(x, int(p, "h")), 2);
      return setTarget(s, t, k === 0 ? sq : add([sq, num(k)], true));
    },
  },
  {
    id: "add_subtract",
    name: "Add and subtract a term",
    blurb: "Add a clever zero: + t − t.",
    params: [{ name: "t", label: "Term to add and subtract", kind: "term", placeholder: "4x^2" }],
    kinds: EXPRISH,
    build(s, t, p) {
      const T = getTarget(s, t);
      const extra = term(p, "t");
      const grouped: Expr = { k: "add", terms: [...(T.k === "add" ? T.terms : [T]), extra] };
      return setTarget({ ...s }, t, { k: "add", terms: [grouped, neg(extra)] });
    },
  },
  {
    id: "substitute",
    name: "Substitute u = …",
    blurb: "Rename a repeated chunk so a familiar shape appears.",
    params: [{ name: "T", label: "Let u stand for", kind: "term", placeholder: "x^2" }],
    kinds: EXPRISH,
    build(s, _t, p) {
      if (s.kind === "mod") throw new MoveError("Not available here.");
      if (s.sub) throw new MoveError("Undo the current substitution first.");
      const T = term(p, "T");
      const names = [...varsOf(T)];
      if (!names.length) throw new MoveError("Substitute for something that contains the variable.");
      const used = new Set<string>();
      mapExprs(s, (e) => (varsOf(e, used), e));
      const u = used.has("u") ? "w" : "u";
      const power = T.k === "pow" && T.base.k === "var" ? { x: T.base.name, k: T.exp } : null;
      const next = mapExprs(s, (e) => {
        let out: Expr;
        const pe = power ? tryPoly(e) : null;
        if (power && pe) {
          const q: Poly = new Map();
          for (const [key, c] of pe) {
            const ex = expsOf(key);
            const n = ex[power.x] ?? 0;
            if (n % power.k) throw new MoveError(`${show(e)} can't be written using only ${show(T)}.`);
            delete ex[power.x];
            if (n) ex[u] = n / power.k;
            q.set(keyOf(ex), c);
          }
          out = fromPoly(q);
        } else out = replace(e, T, v(u));
        if (names.some((n) => varsOf(out).has(n))) throw new MoveError(`After substituting, ${names[0]} still appears. Pick a chunk that covers every ${names[0]}.`);
        return out;
      });
      return { ...next, sub: { name: u, expr: T } } as ExprState;
    },
  },
  {
    id: "back_substitute",
    name: "Substitute back",
    blurb: "Put the original chunk back in place of u.",
    params: [],
    kinds: EXPRISH,
    build(s) {
      if (s.kind === "mod" || !s.sub) throw new MoveError("There is no substitution to undo.");
      const { name, expr } = s.sub;
      const next = mapExprs(s, (e) => replace(e, v(name), expr));
      return { ...next, sub: undefined } as ExprState;
    },
  },
  // ---- equations ----
  {
    id: "to_zero",
    name: "Move everything to one side (= 0)",
    blurb: "Collect all terms on the left so the right side is 0.",
    params: [],
    kinds: ["eqs"],
    build(s, t) {
      const { eq, i, s: st } = eqAt(s, t);
      return withEqs(st, i, [{ lhs: fromPoly(pSub(poly(eq.lhs), poly(eq.rhs))), rhs: num(0) }]);
    },
  },
  {
    id: "add_both",
    name: "Add to both sides",
    blurb: "Add the same term to both sides (use a negative to subtract).",
    params: [{ name: "t", label: "Term to add (negative subtracts)", kind: "term", placeholder: "9" }],
    kinds: ["eqs"],
    build(s, t, p) {
      const { eq, i, s: st } = eqAt(s, t);
      const extra = term(p, "t");
      const plus = (side: Expr) => {
        const a = tryPoly(side);
        const b = tryPoly(extra);
        return a && b ? fromPoly(pAdd(a, b)) : add([side, extra]);
      };
      return withEqs(st, i, [{ lhs: plus(eq.lhs), rhs: plus(eq.rhs) }]);
    },
  },
  {
    id: "div_both",
    name: "Divide both sides",
    blurb: "Divide both sides by the same non-zero quantity.",
    params: [{ name: "t", label: "Divide by", kind: "term", placeholder: "2" }],
    kinds: ["eqs"],
    build(s, t, p) {
      const { eq, i, s: st } = eqAt(s, t);
      const d = term(p, "t");
      const D = poly(d);
      const c = pAsConst(D);
      if (c && c.n === 0) throw new MoveError("You can't divide by 0.");
      const over = (side: Expr) => {
        const q = c ? pScale(poly(side), fDiv(fr(1), c)) : pDivExact(poly(side), D);
        if (!q) throw new MoveError(`${show(d)} doesn't divide both sides evenly.`);
        return fromPoly(q);
      };
      return withEqs(st, i, [{ lhs: over(eq.lhs), rhs: over(eq.rhs) }]);
    },
    explain(_s, _t, p, fallback) {
      const d = term(p, "t");
      return varsOf(d).size ? `${show(d)} can be 0, so dividing by it is not safe. ${fallback}` : undefined;
    },
  },
  {
    id: "zero_product",
    name: "Zero-product rule",
    blurb: "If a product is 0, one of its factors is 0.",
    params: [],
    kinds: ["eqs"],
    build(s, t) {
      const { eq, i, s: st } = eqAt(s, t);
      const fs = eq.lhs.k === "mul" ? eq.lhs.factors : eq.lhs.k === "pow" ? [eq.lhs.base] : null;
      if (!fs) throw new MoveError("There's no product to split yet. Factor first.");
      const branches = fs.map((f) => (f.k === "pow" ? f.base : f)).filter((f) => varsOf(f).size > 0);
      return withEqs(st, i, branches.map((f) => ({ lhs: f, rhs: eq.rhs })));
    },
    explain(s, t, _p, fallback) {
      const { eq } = eqAt(s, t);
      if (eq.rhs.k === "num" && eq.rhs.n === 0) return undefined;
      return `The zero-product rule needs 0 on the other side: a·b = ${show(eq.rhs)} doesn't make a factor equal ${show(eq.rhs)}. ${fallback}`;
    },
  },
  {
    id: "sqrt_both",
    name: "Take square roots of both sides",
    blurb: "If A² = k then A = √k or A = −√k.",
    params: [{ name: "sign", label: "Include the negative root (±)", kind: "toggle", on: "both", off: "plus" }],
    kinds: ["eqs"],
    build(s, t, p) {
      const { eq, i, s: st } = eqAt(s, t);
      if (eq.lhs.k !== "pow" || eq.lhs.exp !== 2) throw new MoveError("Write the left side as a square first.");
      if (varsOf(eq.rhs).size) throw new MoveError("The other side must be a number.");
      const r = evaluate(eq.rhs, {});
      if (r < 0) throw new MoveError("A square is never negative, so there are no real solutions here.");
      const exact = (n: number) => Number.isInteger(Math.sqrt(n));
      const root = eq.rhs.k === "num" && exact(eq.rhs.n) && exact(eq.rhs.d) ? num(Math.sqrt(eq.rhs.n), Math.sqrt(eq.rhs.d)) : sqrt(eq.rhs);
      const base = eq.lhs.base;
      const out: Eq[] = [{ lhs: base, rhs: root }];
      if (r !== 0 && (p.sign ?? "both") !== "plus") out.push({ lhs: base, rhs: neg(root) });
      return withEqs(st, i, out);
    },
    explain(_s, _t, p, fallback) {
      return p.sign === "plus" ? `Both the positive and the negative root square to the same number. ${fallback}` : undefined;
    },
  },
  {
    id: "solve_linear",
    name: "Solve each linear equation",
    blurb: "Isolate the variable in every branch.",
    params: [],
    kinds: ["eqs"],
    build(s) {
      if (s.kind !== "eqs") throw new MoveError("This move needs an equation.");
      const solved = s.eqs.map((eq): Eq => {
        const where = `${show(eq.lhs)} = ${show(eq.rhs)}`;
        const L = tryPoly(eq.lhs);
        const R = tryPoly(eq.rhs);
        if (L && R) {
          const D = pSub(L, R);
          const names = pVars(D);
          const cs = names.length === 1 ? coeffs(D, names[0]) : null;
          if (!cs || cs.length !== 2) throw new MoveError(`${where} isn't linear yet.`);
          const x = fDiv(fNeg(cs[0]), cs[1]);
          return { lhs: v(names[0]), rhs: num(x.n, x.d) };
        }
        // Linear left side, irrational constant on the right (e.g. x + 3 = √7).
        const names = L ? pVars(L) : [];
        const cs = L && names.length === 1 ? coeffs(L, names[0]) : null;
        if (!cs || cs.length !== 2 || varsOf(eq.rhs).size) throw new MoveError(`${where} isn't linear yet.`);
        const shifted = cs[0].n === 0 ? eq.rhs : add([num(-cs[0].n, cs[0].d), eq.rhs], true);
        const rhs: Expr = cs[1].n === 1 && cs[1].d === 1 ? shifted : { k: "div", num: shifted, den: num(cs[1].n, cs[1].d) };
        return { lhs: v(names[0]), rhs };
      });
      const seen = new Set<string>();
      return { ...s, eqs: solved.filter((e) => !seen.has(show(e.lhs) + "=" + show(e.rhs)) && seen.add(show(e.lhs) + "=" + show(e.rhs))) };
    },
  },
  // ---- congruences ----
  {
    id: "reduce_mod",
    name: "Reduce mod n",
    blurb: "Replace each number by its remainder.",
    params: [],
    kinds: ["mod"],
    build(s) {
      if (s.kind !== "mod") throw new MoveError("This move needs a congruence.");
      const m = s.mod;
      const walk = (e: Expr): Expr => {
        switch (e.k) {
          case "num": if (e.d !== 1) throw new MoveError("Only whole numbers can be reduced."); return num(((e.n % m) + m) % m);
          case "add": return add(e.terms.map(walk), true);
          case "mul": return mul(e.factors.map(walk), true);
          case "neg": return neg(walk(e.arg));
          case "pow": return { k: "pow", base: walk(e.base), exp: e.exp }; // exponents are NOT reduced mod n
          default: return e;
        }
      };
      return { ...s, expr: walk(s.expr) };
    },
  },
  {
    id: "cycle",
    name: "Find the cycle of powers",
    blurb: "Powers repeat mod n: reduce the exponent by the cycle length.",
    params: [{ name: "len", label: "Cycle length", kind: "int", placeholder: "4" }],
    kinds: ["mod"],
    build(s, _t, p) {
      if (s.kind !== "mod") throw new MoveError("This move needs a congruence.");
      const len = int(p, "len");
      if (len < 1) throw new MoveError("A cycle length is a positive whole number.");
      const m = s.mod;
      let found = false;
      const walk = (e: Expr): Expr => {
        if (e.k === "pow" && e.base.k === "num" && e.base.d === 1) {
          found = true;
          const b = e.base.n;
          // The claim itself is checked: b^(1+len) must equal b^1 mod m.
          const first = evaluateMod(pow(num(b), 1), {}, m);
          const again = evaluateMod(pow(num(b), 1 + len), {}, m);
          if (first !== again) throw new MoveError(`Powers of ${b} don't repeat every ${len} steps mod ${m}: ${b}¹ ≡ ${first} but ${b}^${1 + len} ≡ ${again}.`);
          if (e.exp < 1) return e;
          return pow(e.base, ((e.exp - 1) % len) + 1);
        }
        if (e.k === "add") return add(e.terms.map(walk), true);
        if (e.k === "mul") return mul(e.factors.map(walk), true);
        if (e.k === "neg") return neg(walk(e.arg));
        return e;
      };
      const expr = walk(s.expr);
      if (!found) throw new MoveError("There is no power of a number to reduce.");
      return { ...s, expr };
    },
  },
  {
    id: "evaluate_mod",
    name: "Work out the remainder",
    blurb: "Compute the value and take its remainder.",
    params: [],
    kinds: ["mod"],
    build(s) {
      if (s.kind !== "mod") throw new MoveError("This move needs a congruence.");
      if (varsOf(s.expr).size) throw new MoveError("There is still a variable in the expression.");
      const r = evaluateMod(s.expr, {}, s.mod);
      if (Number.isNaN(r)) throw new MoveError("Only whole-number expressions make sense mod n.");
      return { ...s, expr: num(r) };
    },
  },
];

// ---- direct manipulations (gestures, not tiles) -----------------------------------
function sumParts(s: ExprState, t: Target): { side: Expr; terms: Expr[] } {
  const side = sideOf(s, { ...t, part: undefined });
  return { side, terms: side.k === "add" ? side.terms : [side] };
}
function index(p: Params, name: string, n: number): number {
  const i = Number(p[name]);
  if (!Number.isInteger(i) || i < 0 || i >= n) throw new MoveError("Pick a term on this side.");
  return i;
}
const withSide = (s: ExprState, t: Target, e: Expr) => setTarget(s, { ...t, part: undefined }, e);
/** Same power of every variable (3x and −5x yes; 3x and 3x² no). */
function likeTerms(a: Expr, b: Expr): boolean {
  const A = tryPoly(a);
  const B = tryPoly(b);
  if (!A || !B || A.size !== 1 || B.size !== 1) return false;
  return [...A.keys()][0] === [...B.keys()][0];
}

const GESTURES: ExprMove[] = [
  {
    id: "combine",
    name: "Combine like terms",
    blurb: "Tap one term, then a like term on the same side.",
    params: [],
    kinds: EXPRISH,
    build(s, t, p) {
      const { terms } = sumParts(s, t);
      const i = index(p, "i", terms.length);
      const j = index(p, "j", terms.length);
      if (i === j) throw new MoveError("Pick two different terms.");
      if (!likeTerms(terms[i], terms[j])) {
        throw new MoveError(`${show(terms[i])} and ${show(terms[j])} aren't like terms: they need exactly the same power of each letter.`);
      }
      const merged = fromPoly(pAdd(poly(terms[i]), poly(terms[j])));
      const [lo, hi] = i < j ? [i, j] : [j, i];
      const rest = terms.filter((_, k) => k !== hi).map((x, k) => (k === lo ? merged : x)).filter((x) => !(x.k === "num" && x.n === 0) || terms.length === 2);
      return withSide(s, t, add(rest, true));
    },
    confirm(s, t, p) {
      const { terms } = sumParts(s, t);
      return `${show(terms[Number(p.i)])} and ${show(terms[Number(p.j)])} have the same power of x, so their coefficients just add.`;
    },
  },
  {
    id: "reorder",
    name: "Regroup terms",
    blurb: "Drag a term to a new place in its sum.",
    params: [],
    kinds: EXPRISH,
    build(s, t, p) {
      const { terms } = sumParts(s, t);
      if (terms.length < 2) throw new MoveError("There is only one term here.");
      const i = index(p, "i", terms.length);
      const to = Math.max(0, Math.min(terms.length, Number(p.to)));
      const moved = terms[i];
      const rest = terms.filter((_, k) => k !== i);
      rest.splice(to > i ? to - 1 : to, 0, moved);
      return withSide(s, t, add(rest, true));
    },
  },
  {
    id: "move_across",
    name: "Move a term across the equals sign",
    blurb: "Drag a term to the other side; its sign flips.",
    params: [],
    kinds: ["eqs"],
    build(s, t, p) {
      const { eq, i, s: st } = eqAt(s, t);
      const from = t.side === "rhs" ? "rhs" : "lhs";
      const { terms } = sumParts(s, { ...t, side: from });
      const k = index(p, "i", terms.length);
      const moved = terms[k];
      const left = terms.filter((_, j) => j !== k);
      const origin = left.length ? add(left, true) : num(0);
      const other = from === "lhs" ? eq.rhs : eq.lhs;
      const flipped = neg(moved);
      const target = other.k === "num" && other.n === 0 ? flipped : add([...(other.k === "add" ? other.terms : [other]), flipped], true);
      // The student flips nothing by hand: the app does it, and the verifier checks the result.
      const next = from === "lhs" ? { lhs: origin, rhs: target } : { lhs: target, rhs: origin };
      return withEqs(st, i, [next]);
    },
    confirm(s, t, p) {
      const { terms } = sumParts(s, t);
      const moved = terms[Number(p.i)];
      return moved ? `Subtracting ${show(moved)} from both sides moves it across with its sign flipped.` : undefined;
    },
  },
];

// ---- toolbox metadata: where each tile sits, and what Level 1 / Level 2 say about it -------
const META: Record<string, Pick<MoveDef, "group" | "kind" | "goal" | "why">> = {
  gcf: { group: "factor", kind: "Pull out the common factor", goal: "Take out what every term shares", why: "It divides every term, and multiplying back gives the same expression." },
  diff_squares: { group: "factor", kind: "Use the difference of squares", goal: "Split a square minus a square into two brackets", why: "A² − B² = (A − B)(A + B): the middle terms cancel when you multiply back." },
  trinomial: { group: "factor", kind: "Factor with sum and product", goal: "Turn the quadratic into a product of two brackets", why: "(x + p)(x + q) = x² + (p + q)x + pq, and your numbers match." },
  split_middle: { group: "factor", kind: "Split the middle term", goal: "Rewrite the middle term so the four terms can be paired", why: "The two pieces add to the middle coefficient and multiply to a·c." },
  group: { group: "factor", kind: "Factor by grouping", goal: "Pair the terms so they share a bracket", why: "Both pairs share the same bracket, so it comes out of the whole sum." },
  perfect_square: { group: "factor", kind: "Spot the perfect square", goal: "Write this as one bracket squared", why: "A² + 2AB + B² = (A + B)², and the middle term is exactly 2AB." },
  expand: { group: "rewrite", kind: "Expand", goal: "Multiply everything out", why: "Expanding never changes the value." },
  complete_square: { group: "rewrite", kind: "Complete the square", goal: "Write it as a square plus a constant", why: "(x + h)² + k multiplies back to the same quadratic." },
  add_subtract: { group: "rewrite", kind: "Add and subtract the same term", goal: "Add a clever zero to reveal a pattern", why: "Adding t and taking t away again adds 0." },
  substitute: { group: "rewrite", kind: "Substitute a new letter", goal: "Rename the repeated chunk so a familiar shape appears", why: "Every copy of the chunk is replaced, so nothing else changes." },
  back_substitute: { group: "rewrite", kind: "Substitute back", goal: "Put the original chunk back", why: "u was only a name for the chunk." },
  to_zero: { group: "equation", kind: "Get 0 on one side", goal: "Get everything onto one side", why: "Subtracting the same thing from both sides keeps every solution." },
  add_both: { group: "equation", kind: "Add the same thing to both sides", goal: "Change both sides the same way", why: "Doing the same to both sides keeps the equation balanced." },
  div_both: { group: "equation", kind: "Divide both sides", goal: "Shrink both sides by the same non-zero number", why: "Dividing both sides by the same non-zero number keeps every solution." },
  zero_product: { group: "equation", kind: "Use the zero-product rule", goal: "Split into one equation per factor", why: "A product is 0 exactly when one of its factors is 0." },
  sqrt_both: { group: "equation", kind: "Take square roots of both sides", goal: "Undo the square", why: "Both √k and −√k square to k, so both are kept." },
  solve_linear: { group: "equation", kind: "Isolate x", goal: "Finish each branch as x = a number", why: "Each branch is linear, so x is pinned to one value." },
  reduce_mod: { group: "mod", kind: "Reduce mod n", goal: "Replace numbers by their remainders", why: "Numbers with the same remainder behave the same mod n." },
  cycle: { group: "mod", kind: "Find the cycle of powers", goal: "Shrink the exponent using a repeating pattern", why: "The powers repeat with that period, which the app checked." },
  evaluate_mod: { group: "mod", kind: "Work out the remainder", goal: "Finish with a single remainder", why: "That is the value of the expression mod n." },
  combine: { kind: "Combine like terms (tap one, then the other)", goal: "Collect matching terms", why: "Like terms have the same power, so their coefficients add." },
  reorder: { kind: "Regroup terms (drag one to a new place)", goal: "Put the terms in a better order", why: "Order doesn't change a sum." },
  move_across: { kind: "Move a term across the = sign", goal: "Get the terms onto one side", why: "Its sign flips because it was subtracted from both sides." },
};

const sh = (p: Params, k: string) => {
  try {
    return show(parseExpr(p[k] ?? ""));
  } catch {
    return p[k] ?? "";
  }
};
const CONFIRM: Record<string, ExprMove["confirm"]> = {
  gcf: (_s, _t, p) => `${sh(p, "f")} divides every term, and multiplying back gives the original.`,
  diff_squares: (_s, _t, p) => `${sh(p, "A")}² − ${sh(p, "B")}² = (A − B)(A + B) with A = ${sh(p, "A")}, B = ${sh(p, "B")}.`,
  trinomial: (_s, _t, p) => `${p.p} + ${p.q} = ${Number(p.p) + Number(p.q)} and ${p.p}·${p.q} = ${Number(p.p) * Number(p.q)}: sum and product match.`.replace(/-/g, "−"),
  split_middle: (_s, _t, p) => `${p.p} + ${p.q} is the middle coefficient and ${p.p}·${p.q} = a·c.`.replace(/-/g, "−"),
  add_both: (_s, _t, p) => `Adding ${sh(p, "t")} to both sides keeps the equation balanced.`,
  div_both: (_s, _t, p) => `Dividing both sides by ${sh(p, "t")} (never 0) keeps every solution.`,
};

export const EXPR_MOVES: (ExprMove & MoveDef)[] = [...RAW_MOVES, ...GESTURES].map((m) => {
  const meta = META[m.id];
  if (!meta) throw new Error(`Move ${m.id} has no toolbox metadata`);
  return { ...m, ...meta, confirm: m.confirm ?? CONFIRM[m.id], gesture: !meta.group };
});
export const exprMove = (id: string) => EXPR_MOVES.find((m) => m.id === id);
/** The standing Module A toolbox: every tile, the same for every card. */
export const EXPR_TOOLBOX: MoveDef[] = EXPR_MOVES.filter((m) => !m.gesture);

/** Build the candidate line, then verify it against the previous one by computation. */
export function applyExprMove(s: ExprState, moveId: string, params: Params = {}, target: Target = {}): ApplyResult<ExprState> {
  const move = exprMove(moveId);
  if (!move) return { ok: false, reason: "Unknown move." };
  // A tile from the standing toolbox that can't act on this kind of line is refused, but not counted as wrong.
  if (!move.kinds.includes(s.kind)) return { ok: false, reason: `"${move.name}" doesn't act on ${s.kind === "eqs" ? "an equation" : s.kind === "mod" ? "a congruence" : "a bare expression"}.`, noop: true };
  let next: ExprState;
  try {
    next = move.build(s, target, params);
  } catch (e) {
    if (e instanceof MoveError) return { ok: false, reason: e.message };
    return { ok: false, reason: "That move doesn't apply here." };
  }
  if (showState(next) === showState(s)) return { ok: false, reason: "That doesn't change anything.", noop: true };
  const verdict = verifyStep(s, next);
  if (verdict.ok) {
    let why: string | undefined;
    try {
      why = move.confirm?.(s, target, params);
    } catch {
      why = undefined;
    }
    return { ok: true, state: next, why: why ?? move.why };
  }

  let reason = verdict.reason;
  let custom: string | undefined;
  try {
    custom = move.explain?.(s, target, params, verdict.reason);
  } catch {
    custom = undefined;
  }
  if (custom) reason = custom;
  else if (!verdict.domain && s.kind !== "mod") {
    // Say what the attempt actually multiplies out to.
    try {
      const before = tryPoly(sideOf(s, target));
      const after = tryPoly(sideOf(next, target));
      const sameShape = s.kind === "expr" || (s.kind === "eqs" && next.kind === "eqs" && s.eqs.length === next.eqs.length);
      if (before && after && sameShape && !pEq(before, after)) {
        reason = `That multiplies out to ${show(fromPoly(after))}, not ${show(fromPoly(before))}.`;
      }
    } catch {
      /* keep the verifier's reason */
    }
  }
  return { ok: false, reason, domain: verdict.domain };
}


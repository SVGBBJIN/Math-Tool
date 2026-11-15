// The Module A verifier: is the new line equivalent to the previous one?
//
// Decided by numeric evaluation at pseudo-random points (seeded by the two lines, so a
// given check is reproducible):
//   expression -> expression : same value wherever the old line is defined
//   equations  -> equations  : same solution set. Each line is turned into one function
//       P(x) = product of (lhs - rhs) over its "or" branches, repeated factors dropped;
//       two lines have the same solutions when P_new / P_old is a non-zero constant.
//       Lines that differ only by repeated roots are compared by exact square-free parts.
//   congruence -> congruence : same residue at integer points
// Undefined points are skipped; a new line that is undefined where the old one was
// defined is reported as a domain problem (e.g. dividing by something that can be zero).
import { add, evaluate, evaluateMod, neg, show, varsOf, type Env, type Expr } from "./ast";
import { coeffs, fEq, pMul, pConst, fr, squareFree, toPoly, type Poly } from "./poly";
import { showState, type ExprState } from "./state";

export type Verdict = { ok: true } | { ok: false; reason: string; domain?: boolean };

const POINTS = 12;
const MIN_VALID = 4;
const close = (a: number, b: number) => Math.abs(a - b) <= 1e-7 * (1 + Math.abs(a) + Math.abs(b));

function rng(seedText: string) {
  let h = 1779033703;
  for (let i = 0; i < seedText.length; i++) h = Math.imul(h ^ seedText.charCodeAt(i), 3432918353);
  return () => {
    h |= 0;
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function exprsOf(s: ExprState): Expr[] {
  return s.kind === "eqs" ? s.eqs.flatMap((e) => [e.lhs, e.rhs]) : [s.expr];
}
const subOf = (s: ExprState) => (s.kind === "mod" ? undefined : s.sub);

/** Free variables once a substitution like u = x² is unwound. */
export function baseVars(s: ExprState): string[] {
  const out = new Set<string>();
  exprsOf(s).forEach((e) => varsOf(e, out));
  const sub = subOf(s);
  if (sub) {
    out.delete(sub.name);
    varsOf(sub.expr, out);
  }
  return [...out].sort();
}
function envFor(s: ExprState, base: Env): Env {
  const sub = subOf(s);
  return sub ? { ...base, [sub.name]: evaluate(sub.expr, base) } : base;
}

export function fmtNum(x: number): string {
  for (let d = 1; d <= 12; d++) {
    const n = x * d;
    if (Math.abs(n - Math.round(n)) < 1e-9) return (n < 0 ? "−" : "") + Math.abs(Math.round(n)) + (d === 1 ? "" : "/" + d);
  }
  return x.toFixed(3).replace("-", "−");
}

/** Small rationals tried when looking for a concrete witness (a lost root, a zero denominator). */
const WITNESSES: number[] = (() => {
  const seen = new Set<number>();
  for (let q = 1; q <= 6; q++) for (let p = -40 * q; p <= 40 * q; p++) seen.add(p / q);
  return [...seen].sort((a, b) => Math.abs(a) - Math.abs(b) || a - b);
})();

function samples(prev: ExprState, next: ExprState, integers = false): Env[] {
  const names = [...new Set([...baseVars(prev), ...baseVars(next)])];
  const rand = rng(showState(prev) + "|" + showState(next));
  return Array.from({ length: POINTS }, () =>
    Object.fromEntries(names.map((n) => [n, integers ? Math.floor(rand() * 60) - 10 : Math.round((rand() * 12 - 6) * 1000) / 1000 + 0.0137])),
  );
}

// ---- expressions ------------------------------------------------------------
function denominators(e: Expr, out: Expr[] = []): Expr[] {
  switch (e.k) {
    case "div": if (varsOf(e.den).size) out.push(e.den); denominators(e.num, out); denominators(e.den, out); break;
    case "add": e.terms.forEach((t) => denominators(t, out)); break;
    case "mul": e.factors.forEach((t) => denominators(t, out)); break;
    case "neg": case "sqrt": denominators(e.arg, out); break;
    case "pow": denominators(e.base, out); break;
  }
  return out;
}

function verifyExpr(prev: ExprState & { kind: "expr" }, next: ExprState & { kind: "expr" }): Verdict {
  let valid = 0;
  for (const base of samples(prev, next)) {
    const a = evaluate(prev.expr, envFor(prev, base));
    if (!Number.isFinite(a)) continue;
    const b = evaluate(next.expr, envFor(next, base));
    if (!Number.isFinite(b)) return { ok: false, domain: true, reason: "The new line is undefined at points where the old one was fine." };
    if (!close(a, b)) return { ok: false, reason: differAt(prev, next) };
    valid++;
  }
  if (valid < MIN_VALID) return { ok: false, reason: "Couldn't evaluate this line at enough points to check it." };
  // A new denominator that can be zero where the old line was defined narrows the domain.
  const names = baseVars(next);
  if (names.length === 1) {
    for (const den of denominators(next.expr)) for (const x of WITNESSES) {
      const base = { [names[0]]: x };
      if (Math.abs(evaluate(den, envFor(next, base))) < 1e-12 && Number.isFinite(evaluate(prev.expr, envFor(prev, base)))) {
        return { ok: false, domain: true, reason: `Dividing by ${show(den)} is undefined when ${names[0]} = ${fmtNum(x)}; the previous line wasn't.` };
      }
    }
  }
  return { ok: true };
}

/** A small, readable point where the two lines differ. */
function differAt(prev: ExprState & { kind: "expr" }, next: ExprState & { kind: "expr" }): string {
  const names = [...new Set([...baseVars(prev), ...baseVars(next)])];
  for (const x of [1, 2, 0, -1, 3, -2]) {
    const base = Object.fromEntries(names.map((n, i) => [n, x + i]));
    const a = evaluate(prev.expr, envFor(prev, base));
    const b = evaluate(next.expr, envFor(next, base));
    if (Number.isFinite(a) && Number.isFinite(b) && !close(a, b)) {
      const at = names.map((n) => `${n} = ${base[n]}`).join(", ");
      return `Not equal: at ${at} the previous line is ${fmtNum(a)} but this is ${fmtNum(b)}.`;
    }
  }
  return "Not equal to the previous line.";
}

// ---- equations --------------------------------------------------------------
type EqState = ExprState & { kind: "eqs" };

/** Factors whose product vanishes exactly on the solution set, with obvious repeats removed. */
function rootFactors(s: EqState): Expr[] {
  const out: Expr[] = [];
  const split = (e: Expr) => {
    if (e.k === "mul") e.factors.forEach(split);
    else if (e.k === "pow" && e.exp >= 1) split(e.base);
    else if (e.k === "neg") split(e.arg);
    else if (varsOf(e).size || evaluate(e, {}) === 0) out.push(e);
  };
  for (const eq of s.eqs) {
    if (eq.rhs.k === "num" && eq.rhs.n === 0) split(eq.lhs);
    else out.push(add([eq.lhs, neg(eq.rhs)], true));
  }
  return out;
}
function product(factors: Expr[], env: Env): number {
  return factors.reduce((p, f) => p * evaluate(f, env), 1);
}
function dedupe(factors: Expr[], s: EqState, pts: Env[]): Expr[] {
  const kept: Expr[] = [];
  for (const f of factors) {
    const dup = kept.some((g) => {
      const ratios = pts.map((b) => evaluate(f, envFor(s, b)) / evaluate(g, envFor(s, b))).filter(Number.isFinite);
      return ratios.length >= MIN_VALID && ratios.every((r) => close(r, ratios[0]) && Math.abs(r) > 1e-12);
    });
    if (!dup) kept.push(f);
  }
  return kept;
}

function exactProduct(s: EqState): Poly | null {
  try {
    return s.eqs.map((e) => toPoly(add([e.lhs, neg(e.rhs)], true))).reduce(pMul, pConst(fr(1)));
  } catch {
    return null;
  }
}
/** Same roots once multiplicity is ignored (one variable, polynomial lines only). */
function sameSquareFree(prev: EqState, next: EqState): boolean {
  if (showSub(prev) !== showSub(next)) return false;
  const a = exactProduct(prev);
  const b = exactProduct(next);
  const names = [...new Set([...exprsOf(prev), ...exprsOf(next)].flatMap((e) => [...varsOf(e)]))];
  if (!a || !b || names.length !== 1) return false;
  const ca = coeffs(a, names[0]);
  const cb = coeffs(b, names[0]);
  if (!ca || !cb) return false;
  const sa = squareFree(ca);
  const sb = squareFree(cb);
  return sa.length > 1 && sa.length === sb.length && sa.every((c, i) => fEq(c, sb[i]));
}
const showSub = (s: EqState) => (s.sub ? `${s.sub.name}=${show(s.sub.expr)}` : "");

function verifyEqs(prev: EqState, next: EqState): Verdict {
  const pts = samples(prev, next);
  const fa = dedupe(rootFactors(prev), prev, pts);
  const fb = dedupe(rootFactors(next), next, pts);
  const ratios: number[] = [];
  let constant = true;
  for (const base of pts) {
    const a = product(fa, envFor(prev, base));
    if (!Number.isFinite(a) || Math.abs(a) < 1e-12) continue;
    const b = product(fb, envFor(next, base));
    if (!Number.isFinite(b)) return { ok: false, domain: true, reason: "The new line is undefined at points where the old one was fine." };
    ratios.push(b / a);
  }
  if (ratios.length < MIN_VALID) constant = false;
  else constant = ratios.every((r) => close(r, ratios[0])) && Math.abs(ratios[0]) > 1e-12;
  if (constant || sameSquareFree(prev, next)) return { ok: true };

  // Not equivalent: look for a concrete root that was lost or added.
  const names = [...new Set([...baseVars(prev), ...baseVars(next)])];
  if (names.length === 1) {
    const isRoot = (s: EqState, fs: Expr[], x: number) => Math.abs(product(fs, envFor(s, { [names[0]]: x }))) < 1e-9;
    for (const x of WITNESSES) {
      const before = isRoot(prev, fa, x);
      const after = isRoot(next, fb, x);
      if (before && !after) return { ok: false, reason: `This loses the solution ${names[0]} = ${fmtNum(x)}.` };
      if (!before && after) return { ok: false, reason: `This adds ${names[0]} = ${fmtNum(x)}, which doesn't satisfy the previous line.` };
    }
  }
  return { ok: false, reason: "This line doesn't have the same solutions as the previous one." };
}

// ---- congruences ------------------------------------------------------------
function verifyMod(prev: ExprState & { kind: "mod" }, next: ExprState & { kind: "mod" }): Verdict {
  if (prev.mod !== next.mod) return { ok: false, reason: "The modulus changed." };
  for (const base of samples(prev, next, true)) {
    const a = evaluateMod(prev.expr, base, prev.mod);
    const b = evaluateMod(next.expr, base, next.mod);
    if (Number.isNaN(a) || Number.isNaN(b)) return { ok: false, reason: "Only whole-number expressions make sense mod n." };
    if (a !== b) {
      const at = Object.entries(base).map(([n, x]) => `${n} = ${x}`).join(", ");
      return { ok: false, reason: `Different residues${at ? ` at ${at}` : ""}: ${a} before, ${b} now (mod ${prev.mod}).` };
    }
  }
  return { ok: true };
}

export function verifyStep(prev: ExprState, next: ExprState): Verdict {
  if (prev.kind === "expr" && next.kind === "expr") return verifyExpr(prev, next);
  if (prev.kind === "eqs" && next.kind === "eqs") return verifyEqs(prev, next);
  if (prev.kind === "mod" && next.kind === "mod") return verifyMod(prev, next);
  return { ok: false, reason: "A move can't change what kind of problem this is." };
}

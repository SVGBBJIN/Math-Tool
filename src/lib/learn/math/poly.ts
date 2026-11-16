// Exact polynomial arithmetic (rational coefficients, any number of variables).
// Decides whether a typed expression equals the expected one (exact, symbolic: no sampling)
// and whether a factorisation is complete.
import { add, gcd, mul, neg, num, pow, v, type Expr } from "./ast";

export interface Frac { n: number; d: number }
export const fr = (n: number, d = 1): Frac => {
  if (d < 0) [n, d] = [-n, -d];
  const g = gcd(n, d) || 1;
  return { n: n / g, d: d / g };
};
export const fAdd = (a: Frac, b: Frac) => fr(a.n * b.d + b.n * a.d, a.d * b.d);
export const fMul = (a: Frac, b: Frac) => fr(a.n * b.n, a.d * b.d);
export const fDiv = (a: Frac, b: Frac) => fr(a.n * b.d, a.d * b.n);
export const fNeg = (a: Frac) => fr(-a.n, a.d);
export const fEq = (a: Frac, b: Frac) => a.n === b.n && a.d === b.d;
export const fVal = (a: Frac) => a.n / a.d;

/** Monomial key -> coefficient. Key is like "x^2*y" (variables sorted), "" for the constant. */
export type Poly = Map<string, Frac>;
export class NotPoly extends Error {}

type Exps = Record<string, number>;
export function keyOf(exps: Exps): string {
  return Object.keys(exps).filter((k) => exps[k] > 0).sort().map((k) => `${k}^${exps[k]}`).join("*");
}
export function expsOf(key: string): Exps {
  const out: Exps = {};
  if (key) for (const part of key.split("*")) {
    const [name, e] = part.split("^");
    out[name] = Number(e);
  }
  return out;
}

function put(p: Poly, key: string, c: Frac) {
  const cur = p.get(key);
  const next = cur ? fAdd(cur, c) : c;
  if (next.n === 0) p.delete(key);
  else p.set(key, next);
}
export const pConst = (c: Frac): Poly => (c.n === 0 ? new Map() : new Map([["", c]]));
export const pVar = (name: string): Poly => new Map([[`${name}^1`, fr(1)]]);
export function pAdd(a: Poly, b: Poly): Poly {
  const out: Poly = new Map(a);
  for (const [k, c] of b) put(out, k, c);
  return out;
}
export function pScale(a: Poly, c: Frac): Poly {
  const out: Poly = new Map();
  if (c.n !== 0) for (const [k, x] of a) out.set(k, fMul(x, c));
  return out;
}
export const pNeg = (a: Poly) => pScale(a, fr(-1));
export const pSub = (a: Poly, b: Poly) => pAdd(a, pNeg(b));
export function pMul(a: Poly, b: Poly): Poly {
  const out: Poly = new Map();
  for (const [ka, ca] of a) for (const [kb, cb] of b) {
    const e = expsOf(ka);
    for (const [name, n] of Object.entries(expsOf(kb))) e[name] = (e[name] ?? 0) + n;
    put(out, keyOf(e), fMul(ca, cb));
  }
  return out;
}
export function pPow(a: Poly, n: number): Poly {
  let out = pConst(fr(1));
  for (let i = 0; i < n; i++) out = pMul(out, a);
  return out;
}
export const pIsZero = (a: Poly) => a.size === 0;
export const pEq = (a: Poly, b: Poly) => pIsZero(pSub(a, b));
export function pVars(a: Poly): string[] {
  const s = new Set<string>();
  for (const k of a.keys()) Object.keys(expsOf(k)).forEach((x) => s.add(x));
  return [...s].sort();
}
const totalDeg = (key: string) => Object.values(expsOf(key)).reduce((s, n) => s + n, 0);
export const pDegree = (a: Poly) => Math.max(0, ...[...a.keys()].map(totalDeg));
/** The constant value of a polynomial with no variables, else null. */
export function pAsConst(a: Poly): Frac | null {
  if (a.size === 0) return fr(0);
  return a.size === 1 && a.has("") ? a.get("")! : null;
}

export function toPoly(e: Expr): Poly {
  switch (e.k) {
    case "num": return pConst(fr(e.n, e.d));
    case "var": return pVar(e.name);
    case "add": return e.terms.map(toPoly).reduce(pAdd, new Map());
    case "mul": return e.factors.map(toPoly).reduce(pMul, pConst(fr(1)));
    case "neg": return pNeg(toPoly(e.arg));
    case "pow": return pPow(toPoly(e.base), e.exp);
    case "div": {
      const den = pAsConst(toPoly(e.den));
      if (!den || den.n === 0) throw new NotPoly("division by a non-constant");
      return pScale(toPoly(e.num), fDiv(fr(1), den));
    }
    case "sqrt": throw new NotPoly("square root");
  }
}
export function tryPoly(e: Expr): Poly | null {
  try {
    return toPoly(e);
  } catch {
    return null;
  }
}

/** Terms in display order: highest total degree first, then alphabetical. */
export function sortedKeys(p: Poly): string[] {
  return [...p.keys()].sort((a, b) => totalDeg(b) - totalDeg(a) || (a < b ? -1 : a > b ? 1 : 0));
}

function monoExpr(key: string, c: Frac): Expr {
  const vars = Object.entries(expsOf(key)).map(([name, n]) => pow(v(name), n));
  const abs = fr(Math.abs(c.n), c.d);
  const body = mul(abs.n === 1 && abs.d === 1 && vars.length ? vars : [num(abs.n, abs.d), ...vars], true);
  if (c.n >= 0) return body;
  return body.k === "num" ? num(-body.n, body.d) : body.k === "mul" && body.factors[0].k === "num" ? mul([neg(body.factors[0]), ...body.factors.slice(1)], true) : neg(body);
}
/** Canonical expanded form. */
export function fromPoly(p: Poly): Expr {
  if (p.size === 0) return num(0);
  return add(sortedKeys(p).map((k) => monoExpr(k, p.get(k)!)), true);
}

// ---- division -------------------------------------------------------------
/** Coefficients [c0, c1, ...] if `p` only uses variable `name`, else null. */
export function coeffs(p: Poly, name: string): Frac[] | null {
  const out: Frac[] = [];
  for (const [k, c] of p) {
    const e = expsOf(k);
    const names = Object.keys(e);
    if (names.length > 1 || (names.length === 1 && names[0] !== name)) return null;
    out[e[name] ?? 0] = c;
  }
  for (let i = 0; i < out.length; i++) out[i] ??= fr(0);
  return out;
}
export function fromCoeffs(cs: Frac[], name: string): Poly {
  const p: Poly = new Map();
  cs.forEach((c, i) => {
    if (c.n !== 0) p.set(i === 0 ? "" : `${name}^${i}`, c);
  });
  return p;
}
const trim = (a: Frac[]) => {
  const out = [...a];
  while (out.length && out[out.length - 1].n === 0) out.pop();
  return out;
};
function divmod(a: Frac[], b: Frac[]): [Frac[], Frac[]] {
  let r = trim(a);
  const d = trim(b);
  const q: Frac[] = [];
  while (r.length >= d.length && r.length) {
    const shift = r.length - d.length;
    const c = fDiv(r[r.length - 1], d[d.length - 1]);
    q[shift] = c;
    r = trim(r.map((x, i) => (i >= shift ? fAdd(x, fNeg(fMul(c, d[i - shift]))) : x)).slice(0, -1));
  }
  for (let i = 0; i < q.length; i++) q[i] ??= fr(0);
  return [q, r];
}

/** a / b when it divides exactly (b a monomial, or both in one shared variable); else null. */
export function pDivExact(a: Poly, b: Poly): Poly | null {
  if (pIsZero(b)) return null;
  if (b.size === 1) {
    const [[kb, cb]] = [...b];
    const eb = expsOf(kb);
    const out: Poly = new Map();
    for (const [ka, ca] of a) {
      const e = expsOf(ka);
      for (const [name, n] of Object.entries(eb)) {
        e[name] = (e[name] ?? 0) - n;
        if (e[name] < 0) return null;
      }
      out.set(keyOf(e), fDiv(ca, cb));
    }
    return out;
  }
  const names = pVars(b);
  if (names.length !== 1) return null;
  const ca = coeffs(a, names[0]);
  const cb = coeffs(b, names[0]);
  if (!ca || !cb) return null;
  const [q, r] = divmod(ca, cb);
  return r.length ? null : fromCoeffs(q, names[0]);
}

/** Largest monomial dividing every term: integer gcd of coefficients × lowest powers. Sign follows the leading term. */
export function content(p: Poly): Poly {
  if (pIsZero(p)) return pConst(fr(1));
  const keys = sortedKeys(p);
  const cs = keys.map((k) => p.get(k)!);
  let g = cs.every((c) => c.d === 1) ? cs.reduce((acc, c) => gcd(acc, c.n), 0) : 1;
  if (cs[0].n < 0) g = -g;
  const min: Exps = { ...expsOf(keys[0]) };
  for (const k of keys.slice(1)) {
    const e = expsOf(k);
    for (const name of Object.keys(min)) min[name] = Math.min(min[name], e[name] ?? 0);
  }
  return new Map([[keyOf(min), fr(g)]]);
}

// ---- one-variable gcd / square-free part (used to compare solution sets) ----
function monic(a: Frac[]): Frac[] {
  const t = trim(a);
  return t.length ? t.map((c) => fDiv(c, t[t.length - 1])) : t;
}
function gcdCoeffs(a: Frac[], b: Frac[]): Frac[] {
  let x = monic(a);
  let y = monic(b);
  while (y.length) [x, y] = [y, monic(divmod(x, y)[1])];
  return x;
}
/** Monic polynomial with the same roots, each once. */
export function squareFree(cs: Frac[]): Frac[] {
  const a = trim(cs);
  if (a.length <= 1) return monic(a);
  const deriv = a.slice(1).map((c, i) => fMul(c, fr(i + 1)));
  return monic(divmod(a, gcdCoeffs(a, deriv))[0]);
}

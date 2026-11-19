// Shared pieces of the step-by-step calculator: tool and result types, input parsing and
// formatting. Everything is exact (BigInt and rationals); nothing is rounded except where a
// step says so. Step text uses the card markup ($…$ math, **bold**; see learn/cards/markup.ts).
import { parseRational, rat, type Rational } from "@/lib/learn/math/rational";

export type { Rational };
export { rat };

export interface Step {
  title: string;
  lines: string[];
}

export interface CalcResult {
  steps: Step[];
  /** The final answer, in markup. */
  answer: string;
}

export type FieldKind = "text" | "select" | "lines";

export interface Field {
  key: string;
  label: string;
  kind?: FieldKind;
  placeholder?: string;
  /** For select fields: value → label. The first is the default. */
  options?: [string, string][];
  optional?: boolean;
  /** Short note under the field. */
  hint?: string;
}

export type Domain = "Number theory" | "Counting" | "Arithmetic" | "Algebra";
export const DOMAINS: Domain[] = ["Arithmetic", "Number theory", "Counting", "Algebra"];

export interface Tool {
  id: string;
  domain: Domain;
  name: string;
  blurb: string;
  fields: Field[];
  /** A worked example to fill the form with. */
  example: Record<string, string>;
  run(values: Record<string, string>): CalcResult;
}

/** A problem with the input: shown to the student as-is, never as a crash. */
export class CalcError extends Error {}

// ---- input --------------------------------------------------------------------------------

const clean = (s: string) => s.trim().replace(/[−–]/g, "-").replace(/\s+/g, "").replace(/(\d),(?=\d{3}(\D|$))/g, "$1");

export function readInt(raw: string | undefined, label: string, opts: { min?: bigint; max?: bigint } = {}): bigint {
  const s = clean(raw ?? "");
  if (!s) throw new CalcError(`Enter ${label}.`);
  if (!/^[+-]?\d+$/.test(s)) throw new CalcError(`${cap(label)} must be a whole number (you typed “${raw?.trim()}”).`);
  const v = BigInt(s);
  if (opts.min !== undefined && v < opts.min) throw new CalcError(`${cap(label)} must be at least ${opts.min}.`);
  if (opts.max !== undefined && v > opts.max) throw new CalcError(`${cap(label)} must be at most ${fmtInt(opts.max)} for this tool.`);
  return v;
}

export function readRat(raw: string | undefined, label: string): Rational {
  const s = (raw ?? "").trim();
  if (!s) throw new CalcError(`Enter ${label}.`);
  const r = parseRational(s);
  if (!r) throw new CalcError(`${cap(label)} must be a number like 5, -2, 3/4 or 0.25 (you typed “${s}”).`);
  return r;
}

export const isBlank = (raw: string | undefined) => !(raw ?? "").trim();

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ---- bigint helpers ----------------------------------------------------------------------

export const babs = (a: bigint) => (a < 0n ? -a : a);
export function bgcd(a: bigint, b: bigint): bigint {
  a = babs(a);
  b = babs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}
export const blcm = (a: bigint, b: bigint) => (a === 0n || b === 0n ? 0n : babs(a / bgcd(a, b) * b));
/** Mathematical mod: always in [0, m). */
export const bmod = (a: bigint, m: bigint) => ((a % m) + m) % m;
export function bsqrt(n: bigint): bigint {
  if (n < 0n) throw new Error("negative");
  if (n < 2n) return n;
  let x = BigInt(Math.floor(Math.sqrt(Number(n))));
  while (x * x > n) x--;
  while ((x + 1n) * (x + 1n) <= n) x++;
  return x;
}
export function factorial(n: bigint): bigint {
  let f = 1n;
  for (let i = 2n; i <= n; i++) f *= i;
  return f;
}
export const digits = (n: bigint) => babs(n).toString().length;

// ---- rationals --------------------------------------------------------------------------

export const R0 = rat(0);
export const R1 = rat(1);
export const isInt = (r: Rational) => r.d === 1n;
export const rNeg = (a: Rational) => rat(-a.n, a.d);
export const rInv = (a: Rational) => {
  if (a.n === 0n) throw new CalcError("Division by zero.");
  return rat(a.d, a.n);
};
export const rCmp = (a: Rational, b: Rational) => {
  const x = a.n * b.d - b.n * a.d;
  return x < 0n ? -1 : x > 0n ? 1 : 0;
};
export function rPow(a: Rational, e: bigint): Rational {
  if (e < 0n) return rPow(rInv(a), -e);
  return rat(a.n ** e, a.d ** e);
}

// ---- formatting (markup) -------------------------------------------------------------------

/** Integer with thousands separators from 10,000 up. */
export function fmtInt(n: bigint): string {
  const s = babs(n).toString();
  const body = s.length > 4 ? s.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : s;
  return n < 0n ? `-${body}` : body;
}

/** A rational as math markup (no surrounding $): 5, -7, \frac{3}{4}, -\frac{3}{4}. */
export function fr(r: Rational): string {
  if (r.d === 1n) return fmtInt(r.n);
  const sign = r.n < 0n ? "-" : "";
  return `${sign}\\frac{${fmtInt(babs(r.n))}}{${fmtInt(r.d)}}`;
}

/** Like fr, wrapped in parentheses when negative or a fraction (for use as a factor or base). */
export function frP(r: Rational): string {
  return r.d === 1n && r.n >= 0n ? fr(r) : `(${fr(r)})`;
}

/** Wrap math markup for a step line. */
export const m = (s: string) => `$${s}$`;

/**
 * Decimal form of a rational: terminating, or repeating with the repeating block in
 * parentheses, e.g. 1/7 = 0.(142857). Returns null when the period is too long to be useful.
 */
export function decimalOf(r: Rational, maxDigits = 40): string | null {
  const neg = r.n < 0n;
  let num = babs(r.n);
  const den = r.d;
  const whole = num / den;
  num %= den;
  if (num === 0n) return `${neg ? "-" : ""}${whole}`;
  const seen = new Map<bigint, number>();
  let out = "";
  while (num !== 0n && !seen.has(num)) {
    if (out.length >= maxDigits) return null;
    seen.set(num, out.length);
    num *= 10n;
    out += (num / den).toString();
    num %= den;
  }
  const body = num === 0n ? out : `${out.slice(0, seen.get(num)!)}(${out.slice(seen.get(num)!)})`;
  return `${neg ? "-" : ""}${whole}.${body}`;
}

/** Guard against results too large to show. */
export function checkSize(r: Rational | bigint, what = "The result") {
  const big = typeof r === "bigint" ? digits(r) : Math.max(digits(r.n), digits(r.d));
  if (big > 120) throw new CalcError(`${what} has more than 120 digits; try smaller numbers.`);
}

// Exact rational numbers on BigInt. Typed answers are compared exactly: "0.75", "3/4" and
// "6/8" are the same number, and nothing is ever rounded.

export interface Rational { n: bigint; d: bigint }

const abs = (a: bigint) => (a < 0n ? -a : a);
function gcd(a: bigint, b: bigint): bigint {
  a = abs(a);
  b = abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

export function rat(n: bigint | number, d: bigint | number = 1n): Rational {
  let nn = BigInt(n);
  let dd = BigInt(d);
  if (dd === 0n) throw new Error("zero denominator");
  if (dd < 0n) [nn, dd] = [-nn, -dd];
  const g = gcd(nn, dd) || 1n;
  return { n: nn / g, d: dd / g };
}

export const rEq = (a: Rational, b: Rational) => a.n === b.n && a.d === b.d;
export const rAdd = (a: Rational, b: Rational) => rat(a.n * b.d + b.n * a.d, a.d * b.d);
export const rSub = (a: Rational, b: Rational) => rat(a.n * b.d - b.n * a.d, a.d * b.d);
export const rMul = (a: Rational, b: Rational) => rat(a.n * b.n, a.d * b.d);
export const rDiv = (a: Rational, b: Rational) => rat(a.n * b.d, a.d * b.n);
export const rShow = (a: Rational) => (a.d === 1n ? `${a.n}` : `${a.n}/${a.d}`);

/**
 * Parse what a student might type for a number: 42, -7, 3/4, -3/4, 0.75, .5, 1,250.
 * Returns null for anything else (so "about 3" is "not a number", never a wrong answer).
 */
export function parseRational(input: string): Rational | null {
  const s = input.trim().replace(/[−–]/g, "-").replace(/\s+/g, "").replace(/(\d),(?=\d{3}(\D|$))/g, "$1");
  const one = (t: string): Rational | null => {
    const m = /^([+-]?)(\d*)(?:\.(\d+))?$/.exec(t);
    if (!m || (m[2] === "" && m[3] === undefined)) return null;
    const digits = (m[2] || "0") + (m[3] ?? "");
    const r = rat(BigInt(digits), 10n ** BigInt((m[3] ?? "").length));
    return m[1] === "-" ? rat(-r.n, r.d) : r;
  };
  const parts = s.split("/");
  if (parts.length === 1) return one(s);
  if (parts.length !== 2) return null;
  const [a, b] = [one(parts[0]), one(parts[1])];
  if (!a || !b || b.n === 0n) return null;
  return rDiv(a, b);
}

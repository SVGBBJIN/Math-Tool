// Arithmetic: exact evaluation of an expression with fractions, one operation per step, and
// conversion between bases.
import { rAdd, rDiv, rMul, rSub } from "@/lib/learn/math/rational";
import {
  CalcError, babs, blcm, checkSize, decimalOf, fmtInt, fr, isInt, m, rInv, rNeg, rPow, rat, readInt,
  type CalcResult, type Rational, type Step, type Tool,
} from "./core";

// ---- expressions --------------------------------------------------------------------------

type Op = "+" | "-" | "*" | "/" | "^";
export type Expr =
  | { t: "num"; v: Rational; show?: string } // show: how it was typed (0.25, 6/8) until simplified
  | { t: "neg"; a: Expr }
  | { t: "bin"; op: Op; a: Expr; b: Expr };

type Tok = { k: "num"; s: string } | { k: "frac"; n: bigint; d: bigint } | { k: "op"; s: Op; typed?: string } | { k: "(" } | { k: ")" };

function tokenize(src: string): Tok[] {
  const s = src.replace(/[−–]/g, "-").replace(/[×·]/g, "*").replace(/\*\*/g, "^").replace(/[[{]/g, "(").replace(/[\]}]/g, ")");
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[\d.]/.test(c)) {
      const mm = /^(\d+(?:,\d{3})*(?!\d)|\d+)?(\.\d+)?/.exec(s.slice(i))!;
      if (!mm[0] || mm[0] === ".") throw new CalcError(`I can't read the number at “${s.slice(i, i + 6)}”.`);
      out.push({ k: "num", s: mm[0].replace(/,/g, "") });
      i += mm[0].length;
      continue;
    }
    if ("+-*/^÷".includes(c)) { out.push({ k: "op", s: (c === "÷" ? "/" : c) as Op, typed: c }); i++; continue; }
    if (c === "(") { out.push({ k: "(" }); i++; continue; }
    if (c === ")") { out.push({ k: ")" }); i++; continue; }
    throw new CalcError(`“${c}” isn't something I can calculate with. Use numbers, + − × ÷ ^ and brackets.`);
  }
  // Implicit multiplication: 2(3+4), (1+2)(3+4), (2)3.
  const withMul: Tok[] = [];
  for (const t of out) {
    const prev = withMul[withMul.length - 1];
    if (prev && (prev.k === "num" || prev.k === ")") && (t.k === "(" || (t.k === "num" && prev.k === ")"))) withMul.push({ k: "op", s: "*" });
    withMul.push(t);
  }
  // A whole number typed with "/" over a whole number is a fraction (3/4), binding tighter than
  // × and ÷, unless a power is attached to either side (2^3/4 is (2^3) ÷ 4). "÷" always divides.
  const merged: Tok[] = [];
  const isOp = (t: Tok | undefined, s: string) => t?.k === "op" && t.typed === s;
  for (let k = 0; k < withMul.length; k++) {
    const [a, slash, b] = [withMul[k], withMul[k + 1], withMul[k + 2]];
    if (a.k === "num" && !a.s.includes(".") && isOp(slash, "/") && b?.k === "num" && !b.s.includes(".") && !isOp(merged[merged.length - 1], "^") && !isOp(withMul[k + 3], "^")) {
      if (BigInt(b.s) === 0n) throw new CalcError("The expression divides by zero.");
      merged.push({ k: "frac", n: BigInt(a.s), d: BigInt(b.s) });
      k += 2;
    } else merged.push(a);
  }
  return merged;
}

const numLeaf = (s: string): Expr => {
  const [w, f = ""] = s.split(".");
  const v = rat(BigInt((w || "0") + f), 10n ** BigInt(f.length));
  return f ? { t: "num", v, show: s.startsWith(".") ? `0${s}` : s } : { t: "num", v };
};

export function parseExpr(src: string): Expr {
  const toks = tokenize(src);
  if (!toks.length) throw new CalcError("Enter an expression, e.g. 3/4 + 5/6 × 2.");
  let i = 0;
  const peek = () => toks[i];

  // expr := term (('+'|'-') term)*
  const expr = (): Expr => {
    let left = term();
    for (let t = peek(); t && t.k === "op" && (t.s === "+" || t.s === "-"); t = peek()) {
      i++;
      left = { t: "bin", op: t.s, a: left, b: term() };
    }
    return left;
  };
  // term := unary (('*'|'/') unary)*
  const term = (): Expr => {
    let left = unary();
    for (let t = peek(); t && t.k === "op" && (t.s === "*" || t.s === "/"); t = peek()) {
      i++;
      left = { t: "bin", op: t.s, a: left, b: unary() };
    }
    return left;
  };
  // unary := '-' unary | '+' unary | power
  const unary = (): Expr => {
    const t = peek();
    if (t?.k === "op" && (t.s === "-" || t.s === "+")) {
      i++;
      const a = unary();
      if (t.s === "+") return a;
      return a.t === "num" && !a.show ? { t: "num", v: rNeg(a.v) } : { t: "neg", a };
    }
    return power();
  };
  // power := atom ('^' unary)?   (right-associative; -2^2 = -(2^2))
  const power = (): Expr => {
    const base = atom();
    const t = peek();
    if (t?.k === "op" && t.s === "^") {
      i++;
      return { t: "bin", op: "^", a: base, b: unary() };
    }
    return base;
  };
  const atom = (): Expr => {
    const t = peek();
    if (!t) throw new CalcError("The expression ends too early.");
    if (t.k === "num") {
      i++;
      return numLeaf(t.s);
    }
    if (t.k === "frac") {
      i++;
      return { t: "num", v: rat(t.n, t.d), show: `\\frac{${fmtInt(t.n)}}{${fmtInt(t.d)}}` };
    }
    if (t.k === "(") {
      i++;
      const e = expr();
      if (peek()?.k !== ")") throw new CalcError("A bracket is never closed.");
      i++;
      // A bracketed number is just the number; keep it as a leaf.
      return e;
    }
    if (t.k === ")") throw new CalcError("There's a closing bracket with nothing before it.");
    throw new CalcError(`“${t.typed ?? t.s}” is missing a number before it.`);
  };
  const e = expr();
  if (i < toks.length) throw new CalcError(toks[i].k === ")" ? "There's an extra closing bracket." : "I couldn't read the whole expression; check the operators.");
  return e;
}

const PREC: Record<Op, number> = { "+": 1, "-": 1, "*": 2, "/": 2, "^": 4 };
const negLike = (e: Expr) => e.t === "neg" || (e.t === "num" && e.v.n < 0n);
function precOf(e: Expr): number {
  if (e.t === "bin") return PREC[e.op];
  if (negLike(e)) return 3;
  if (e.t === "num" && (!isInt(e.v) || e.show)) return 4.5; // fractions and decimals: bracket as a power's base
  return 5;
}

/** Markup for an expression, with brackets only where needed. */
export function showExpr(e: Expr): string {
  if (e.t === "num") return e.show ?? fr(e.v);
  if (e.t === "neg") {
    const inner = precOf(e.a) <= 3 ? `(${showExpr(e.a)})` : showExpr(e.a);
    return `-${inner}`;
  }
  const p = PREC[e.op];
  const wrap = (c: Expr, side: "a" | "b") => {
    const cp = precOf(c);
    const need =
      e.op === "^"
        ? side === "a" ? cp <= 4.5 : false
        : cp < p || (side === "b" && (negLike(c) || (cp === p && (e.op === "-" || e.op === "/"))));
    return need ? `(${showExpr(c)})` : showExpr(c);
  };
  if (e.op === "^") return `${wrap(e.a, "a")}^{${showExpr(e.b)}}`;
  const sym = { "+": "+", "-": "-", "*": "\\cdot", "/": "\\div" }[e.op];
  return `${wrap(e.a, "a")} ${sym} ${wrap(e.b, "b")}`;
}

const opnd = (r: Rational) => (r.n < 0n ? `(${fr(r)})` : fr(r));

/** Do one operation; return the value and the lines that explain it. */
function apply(op: Op, a: Rational, b: Rational): { v: Rational; lines: string[]; title: string } {
  const sym = { "+": "+", "-": "-", "*": "\\cdot", "/": "\\div", "^": "^" }[op];
  const lhs = `${opnd(a)} ${sym} ${opnd(b)}`;
  if (op === "+" || op === "-") {
    const v = op === "+" ? rAdd(a, b) : rSub(a, b);
    const title = op === "+" ? "Add" : "Subtract";
    if (isInt(a) && isInt(b)) return { v, title, lines: [m(`${lhs} = ${fr(v)}`)] };
    const L = blcm(a.d, b.d);
    const an = a.n * (L / a.d);
    const bn = b.n * (L / b.d);
    const raw = op === "+" ? an + bn : an - bn;
    const parts: string[] = [lhs];
    if (a.d !== L || b.d !== L) parts.push(`\\frac{${fmtInt(an)}}{${fmtInt(L)}} ${sym} ${bn < 0n ? `(\\frac{${fmtInt(bn)}}{${fmtInt(L)}})` : `\\frac{${fmtInt(bn)}}{${fmtInt(L)}}`}`);
    parts.push(`\\frac{${fmtInt(raw)}}{${fmtInt(L)}}`);
    if (!(v.n === raw && v.d === L)) parts.push(fr(v));
    const lines = a.d !== b.d ? [`Common denominator: ${m(`\\text{LCM}(${fmtInt(a.d)},\\text{ }${fmtInt(b.d)}) = ${fmtInt(L)}`)}.`] : [];
    return { v, title: `${title} fractions`, lines: [...lines, m(parts.join(" = "))] };
  }
  if (op === "*") {
    const v = rMul(a, b);
    if (isInt(a) && isInt(b)) return { v, title: "Multiply", lines: [m(`${lhs} = ${fr(v)}`)] };
    const parts = [lhs, `\\frac{${opnd(rat(a.n))} \\cdot ${opnd(rat(b.n))}}{${fmtInt(a.d)} \\cdot ${fmtInt(b.d)}}`];
    const rn = a.n * b.n;
    const rd = a.d * b.d;
    parts.push(`\\frac{${fmtInt(rn)}}{${fmtInt(rd)}}`);
    if (!(v.n === rn && v.d === rd)) parts.push(fr(v));
    return { v, title: "Multiply fractions", lines: [`Multiply the tops and the bottoms, then simplify.`, m(parts.join(" = "))] };
  }
  if (op === "/") {
    if (b.n === 0n) throw new CalcError("The expression divides by zero.");
    const v = rDiv(a, b);
    if (isInt(a) && isInt(b)) {
      return { v, title: "Divide", lines: [m(`${lhs} = ${fr(v)}`), ...(isInt(v) ? [] : [`It doesn't divide evenly, so keep it as a fraction in lowest terms.`])] };
    }
    const flip = rInv(b);
    const mul = apply("*", a, flip);
    return { v, title: "Divide fractions", lines: [`Dividing is multiplying by the reciprocal: ${m(`${lhs} = ${opnd(a)} \\cdot ${opnd(flip)}`)}.`, ...mul.lines.slice(-1)] };
  }
  // power
  if (!isInt(b)) throw new CalcError("Exponents must be whole numbers here (a fractional power is usually irrational).");
  const e = b.n;
  if (babs(e) > 400n) throw new CalcError("That exponent is too large to show.");
  if (a.n === 0n && e <= 0n) throw new CalcError(e === 0n ? "0 to the power 0 is undefined." : "0 to a negative power divides by zero.");
  const v = rPow(a, e);
  checkSize(v);
  const base = a.n < 0n || !isInt(a) ? `(${fr(a)})` : fr(a);
  const lines: string[] = [];
  if (e < 0n) {
    lines.push(`A negative exponent means the reciprocal: ${m(`${base}^{${e}} = ${fr(rInv(a)).startsWith("-") || !isInt(rInv(a)) ? `(${fr(rInv(a))})` : fr(rInv(a))}^{${-e}}`)}.`);
  }
  if (!isInt(a)) {
    const pa = e < 0n ? rInv(a) : a;
    const pe = babs(e);
    lines.push(m(`${e < 0n ? `(${fr(pa)})^{${pe}}` : `${base}^{${e}}`} = \\frac{${pa.n < 0n ? `(${fmtInt(pa.n)})` : fmtInt(pa.n)}^{${pe}}}{${fmtInt(pa.d)}^{${pe}}} = ${fr(v)}`));
  } else if (e < 0n) {
    lines.push(m(`\\frac{1}{${base}^{${-e}}} = ${fr(v)}`));
  } else {
    lines.push(m(`${base}^{${e}} = ${fr(v)}`));
  }
  return { v, title: "Power", lines };
}

/** Find the first operation whose inputs are both numbers (evaluation order), and do it. */
function reduceOnce(e: Expr): { e: Expr; step?: { v: Rational; lines: string[]; title: string } } {
  if (e.t === "num") return { e };
  if (e.t === "neg") {
    const r = reduceOnce(e.a);
    if (r.step) return { e: { t: "neg", a: r.e }, step: r.step };
    if (r.e.t === "num") return { e: { t: "num", v: rNeg(r.e.v) } }; // silent sign fold
    return { e };
  }
  const ra = reduceOnce(e.a);
  if (ra.step) return { e: { ...e, a: ra.e }, step: ra.step };
  const rb = reduceOnce(e.b);
  if (rb.step) return { e: { ...e, a: ra.e, b: rb.e }, step: rb.step };
  const a = ra.e;
  const b = rb.e;
  if (a.t === "num" && b.t === "num") {
    const step = apply(e.op, a.v, b.v);
    checkSize(step.v);
    return { e: { t: "num", v: step.v }, step };
  }
  return { e: { ...e, a, b } };
}

function collectShown(e: Expr, out: Expr[] = []): Expr[] {
  if (e.t === "num") {
    if (e.show) out.push(e);
  } else if (e.t === "neg") collectShown(e.a, out);
  else {
    collectShown(e.a, out);
    collectShown(e.b, out);
  }
  return out;
}
function clearShown(e: Expr): Expr {
  if (e.t === "num") return { t: "num", v: e.v };
  if (e.t === "neg") {
    const a = clearShown(e.a);
    return a.t === "num" ? { t: "num", v: rNeg(a.v) } : { t: "neg", a };
  }
  return { ...e, a: clearShown(e.a), b: clearShown(e.b) };
}

export function evaluate(src: string): { steps: Step[]; value: Rational } {
  let e = parseExpr(src);
  const steps: Step[] = [{ title: "Start", lines: [m(showExpr(e))] }];
  const shown = collectShown(e).filter((n) => n.t === "num" && n.show !== fr(n.v));
  if (shown.length) {
    const lines = shown.map((n) => (n.t === "num" ? m(`${n.show} = ${fr(n.v)}`) : ""));
    e = clearShown(e);
    steps.push({ title: "Write each number as a fraction in lowest terms", lines: [...lines, `Now: ${m(showExpr(e))}`] });
  } else e = clearShown(e);
  let guard = 0;
  while (e.t !== "num") {
    if (++guard > 60) throw new CalcError("That expression has too many operations to show step by step; split it up.");
    const r = reduceOnce(e);
    e = r.e;
    if (!r.step) continue;
    steps.push({ title: r.step.title, lines: e.t === "num" ? r.step.lines : [...r.step.lines, `Now: ${m(showExpr(e))}`] });
  }
  return { steps, value: e.v };
}

/** The final answer: fraction, mixed number and decimal. */
export function describeValue(v: Rational): string {
  const parts = [m(fr(v))];
  if (!isInt(v)) {
    if (babs(v.n) > v.d) {
      const w = babs(v.n) / v.d;
      const r = babs(v.n) % v.d;
      parts.push(`mixed number ${m(`${v.n < 0n ? "-" : ""}${fmtInt(w)}\\text{ }\\frac{${fmtInt(r)}}{${fmtInt(v.d)}}`)}`);
    }
    const d = decimalOf(v);
    if (d) parts.push(`decimal ${d.includes("(") ? `${d} (the digits in brackets repeat)` : d}`);
  }
  return parts.join(" · ");
}

const exprTool: Tool = {
  id: "expr",
  domain: "Arithmetic",
  name: "Exact fraction arithmetic",
  blurb: "Evaluate an expression exactly, one operation at a time, in the right order.",
  fields: [
    {
      key: "expr",
      label: "Expression",
      placeholder: "e.g. (3/4 + 5/6) ÷ 7/12 - 2^3",
      hint: "Use + − * / ^ and brackets. 3/4 is read as a fraction; decimals like 0.25 work too.",
    },
  ],
  example: { expr: "(2/3 - 1/4) * 12/5 + (1/2)^3" },
  run(v): CalcResult {
    const { steps, value } = evaluate(v.expr ?? "");
    return { steps, answer: describeValue(value) };
  },
};

// ---- bases ------------------------------------------------------------------------------

const DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const inBase = (s: string, b: bigint) => (/[A-Z]/.test(s) ? `\\text{${s}}_{${b}}` : `${s}_{${b}}`);

const baseTool: Tool = {
  id: "base",
  domain: "Arithmetic",
  name: "Base conversion",
  blurb: "Convert a whole number between bases 2 to 36, through base 10.",
  fields: [
    { key: "n", label: "Number", placeholder: "e.g. 2026 or 1A3", hint: "Digits above 9 are letters: A = 10, B = 11, …" },
    { key: "from", label: "From base", placeholder: "e.g. 10" },
    { key: "to", label: "To base", placeholder: "e.g. 7" },
  ],
  example: { n: "2026", from: "10", to: "7" },
  run(v): CalcResult {
    const from = readInt(v.from, "the starting base", { min: 2n, max: 36n });
    const to = readInt(v.to, "the target base", { min: 2n, max: 36n });
    const s = (v.n ?? "").trim().toUpperCase().replace(/\s+/g, "");
    if (!s) throw new CalcError("Enter the number to convert.");
    if (s.length > 60) throw new CalcError("That number is too long; use at most 60 digits.");
    for (const c of s) {
      const d = DIGITS.indexOf(c);
      if (d < 0) throw new CalcError(`“${c}” isn't a digit. Use 0–9 and letters A–Z.`);
      if (BigInt(d) >= from) throw new CalcError(`“${c}” (worth ${d}) can't appear in base ${from}; digits there go up to ${DIGITS[Number(from) - 1]}.`);
    }
    const steps: Step[] = [];
    let n = 0n;
    for (const c of s) n = n * from + BigInt(DIGITS.indexOf(c));
    if (from !== 10n) {
      const ds = [...s].map((c) => BigInt(DIGITS.indexOf(c)));
      const L = ds.length;
      if (L <= 8) {
        const terms = ds.map((d, k) => `${d} \\cdot ${from}^{${L - 1 - k}}`);
        const vals = ds.map((d, k) => fmtInt(d * from ** BigInt(L - 1 - k)));
        steps.push({
          title: "Convert to base 10",
          lines: [`Each digit is worth its value times a power of ${from}, by position:`, m(`${inBase(s, from)} = ${terms.join(" + ")}`), m(`= ${vals.join(" + ")} = ${fmtInt(n)}`)],
        });
      } else {
        const lines: string[] = [];
        let acc = 0n;
        for (const d of ds) {
          const next = acc * from + d;
          lines.push(m(`${fmtInt(acc)} \\cdot ${from} + ${d} = ${fmtInt(next)}`));
          acc = next;
        }
        steps.push({ title: "Convert to base 10", lines: [`Read the digits left to right: multiply what you have by ${from}, then add the next digit.`, ...lines] });
      }
    } else if (to === 10n) {
      steps.push({ title: "Nothing to do", lines: ["Both bases are 10."] });
    }
    if (to === 10n) return { steps, answer: m(`${inBase(s, from)} = ${fmtInt(n)}_{10}`) };

    const lines: string[] = [];
    const rems: bigint[] = [];
    let x = n;
    if (x === 0n) rems.push(0n);
    while (x > 0n) {
      const q = x / to;
      const r = x % to;
      lines.push(m(`${fmtInt(x)} = ${fmtInt(q)} \\cdot ${to} + ${r}`) + (r >= 10n ? ` (remainder ${r} is the digit ${DIGITS[Number(r)]})` : ""));
      rems.push(r);
      x = q;
    }
    const out = rems.reverse().map((r) => DIGITS[Number(r)]).join("");
    steps.push({ title: `Divide by ${to} repeatedly`, lines: [`Each remainder is the next digit, from the right.`, ...lines] });
    steps.push({ title: "Read the remainders upward", lines: [`The last remainder is the leading digit: ${m(inBase(out, to))}.`] });
    return { steps, answer: m(`${inBase(s, from)} = ${inBase(out, to)}`) };
  },
};

export const ARITHMETIC_TOOLS: Tool[] = [exprTool, baseTool];

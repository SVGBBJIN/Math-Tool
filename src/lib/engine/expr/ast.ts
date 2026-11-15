// Expression trees for Module A: parse, print, evaluate. No simplification happens here:
// the tree is exactly what the student sees, so "x² + 3x + 4x + 12" stays four terms.

export type Expr =
  | { k: "num"; n: number; d: number } // rational n/d, d > 0, reduced
  | { k: "var"; name: string }
  | { k: "add"; terms: Expr[] }
  | { k: "mul"; factors: Expr[] }
  | { k: "neg"; arg: Expr }
  | { k: "pow"; base: Expr; exp: number } // non-negative integer exponent
  | { k: "div"; num: Expr; den: Expr }
  | { k: "sqrt"; arg: Expr };

export function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

export function num(n: number, d = 1): Expr {
  if (d === 0) throw new Error("zero denominator");
  if (d < 0) [n, d] = [-n, -d];
  const g = gcd(n, d) || 1;
  return { k: "num", n: n / g, d: d / g };
}
export const v = (name: string): Expr => ({ k: "var", name });
export const sqrt = (arg: Expr): Expr => ({ k: "sqrt", arg });
export const pow = (base: Expr, exp: number): Expr => (exp === 1 ? base : { k: "pow", base, exp });

export function neg(e: Expr): Expr {
  if (e.k === "num") return num(-e.n, e.d);
  if (e.k === "neg") return e.arg;
  return { k: "neg", arg: e };
}
/** Sum; flattens nested sums unless `keepGroups` (used when parentheses carry meaning). */
export function add(terms: Expr[], keepGroups = false): Expr {
  const flat = keepGroups ? terms : terms.flatMap((t) => (t.k === "add" ? t.terms : [t]));
  if (flat.length === 0) return num(0);
  return flat.length === 1 ? flat[0] : { k: "add", terms: flat };
}
export function mul(factors: Expr[], keepGroups = false): Expr {
  const flat = keepGroups ? factors : factors.flatMap((f) => (f.k === "mul" ? f.factors : [f]));
  if (flat.length === 0) return num(1);
  return flat.length === 1 ? flat[0] : { k: "mul", factors: flat };
}

export const isNum = (e: Expr): e is Extract<Expr, { k: "num" }> => e.k === "num";
export const isZero = (e: Expr) => e.k === "num" && e.n === 0;

export function varsOf(e: Expr, out = new Set<string>()): Set<string> {
  switch (e.k) {
    case "var": out.add(e.name); break;
    case "add": e.terms.forEach((t) => varsOf(t, out)); break;
    case "mul": e.factors.forEach((t) => varsOf(t, out)); break;
    case "neg": case "sqrt": varsOf(e.arg, out); break;
    case "pow": varsOf(e.base, out); break;
    case "div": varsOf(e.num, out); varsOf(e.den, out); break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------
const SUPER = "⁰¹²³⁴⁵⁶⁷⁸⁹";

export class ParseError extends Error {}

function normalize(src: string): string {
  let s = src.replace(/[−–]/g, "-").replace(/[·×]/g, "*").replace(/÷/g, "/").replace(/√/g, " sqrt ");
  s = s.replace(new RegExp(`[${SUPER}]+`, "g"), (m) => "^" + [...m].map((c) => SUPER.indexOf(c)).join(""));
  return s;
}

type Tok = { t: "num"; v: number } | { t: "id"; v: string } | { t: "op"; v: string };

function tokenize(src: string): Tok[] {
  const s = normalize(src);
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) i++;
    else if (/\d/.test(c)) {
      let j = i;
      while (j < s.length && /\d/.test(s[j])) j++;
      out.push({ t: "num", v: Number(s.slice(i, j)) });
      i = j;
    } else if (/[a-zA-Z]/.test(c)) {
      if (s.startsWith("sqrt", i)) {
        out.push({ t: "id", v: "sqrt" });
        i += 4;
      } else {
        out.push({ t: "id", v: c }); // single-letter variables: "xy" is x·y
        i++;
      }
    } else if ("+-*/^()".includes(c)) {
      out.push({ t: "op", v: c });
      i++;
    } else throw new ParseError(`Unexpected "${c}"`);
  }
  return out;
}

export function parseExpr(src: string): Expr {
  const toks = tokenize(src);
  let pos = 0;
  const peek = () => toks[pos];
  const isOp = (x: string) => peek()?.t === "op" && peek().v === x;
  const eat = (x: string) => {
    if (!isOp(x)) throw new ParseError(`Expected "${x}"`);
    pos++;
  };

  function expr(): Expr {
    const terms: Expr[] = [term()];
    while (isOp("+") || isOp("-")) {
      const minus = toks[pos++].v === "-";
      const t = term();
      terms.push(minus ? neg(t) : t);
    }
    return add(terms, true);
  }
  function term(): Expr {
    let fs: Expr[] = [unary()];
    for (;;) {
      if (isOp("*")) {
        pos++;
        fs.push(unary());
      } else if (isOp("/")) {
        pos++;
        const den = unary();
        const top = mul(fs, true);
        fs = [isNum(top) && isNum(den) && den.n !== 0 ? num(top.n * den.d, top.d * den.n) : { k: "div", num: top, den }];
      } else if (peek() && (peek().t === "id" || peek().t === "num" || isOp("("))) {
        fs.push(power()); // implicit multiplication
      } else break;
    }
    return mul(fs, true);
  }
  function unary(): Expr {
    if (isOp("-")) {
      pos++;
      return neg(unary());
    }
    if (isOp("+")) pos++;
    return power();
  }
  function power(): Expr {
    const base = atom();
    if (isOp("^")) {
      pos++;
      const t = toks[pos++];
      if (!t || t.t !== "num" || !Number.isInteger(t.v)) throw new ParseError("Exponent must be a whole number");
      return { k: "pow", base, exp: t.v };
    }
    return base;
  }
  function atom(): Expr {
    const t = toks[pos++];
    if (!t) throw new ParseError("Unexpected end");
    if (t.t === "num") return num(t.v);
    if (t.t === "id") return t.v === "sqrt" ? sqrt(atom()) : v(t.v);
    if (t.v === "(") {
      const e = expr();
      eat(")");
      return e;
    }
    throw new ParseError(`Unexpected "${t.v}"`);
  }

  const e = expr();
  if (pos < toks.length) throw new ParseError(`Unexpected "${toks[pos].v}"`);
  return e;
}

// ---------------------------------------------------------------------------
// Printing (Unicode, phone-friendly). parseExpr(show(e)) gives back the same tree.
// ---------------------------------------------------------------------------
const sup = (n: number) => [...String(n)].map((c) => SUPER[Number(c)]).join("");

/** Split a term into (isNegative, positive body) for "a − b" printing. */
export function splitSign(t: Expr): [boolean, Expr] {
  if (t.k === "neg") return [true, t.arg];
  if (t.k === "num" && t.n < 0) return [true, num(-t.n, t.d)];
  if (t.k === "mul" && t.factors[0].k === "num" && t.factors[0].n < 0) {
    const first = num(-t.factors[0].n, t.factors[0].d);
    const rest = t.factors.slice(1);
    const body = first.k === "num" && first.n === 1 && first.d === 1 && rest.length ? rest : [first, ...rest];
    return [true, mul(body, true)];
  }
  return [false, t];
}

const atomic = (e: Expr) => e.k === "var" || (e.k === "num" && e.n >= 0 && e.d === 1);

export function show(e: Expr): string {
  switch (e.k) {
    case "num":
      return (e.n < 0 ? "−" : "") + Math.abs(e.n) + (e.d === 1 ? "" : "/" + e.d);
    case "var":
      return e.name;
    case "neg":
      return "−" + (e.arg.k === "add" || e.arg.k === "neg" || (e.arg.k === "num" && e.arg.n < 0) ? `(${show(e.arg)})` : show(e.arg));
    case "add":
      return e.terms
        .map((t, i) => {
          const [minus, body] = splitSign(t);
          const s = body.k === "add" ? `(${show(body)})` : show(body);
          return i === 0 ? (minus ? "−" : "") + s : (minus ? " − " : " + ") + s;
        })
        .join("");
    case "mul": {
      let sign = "";
      let fs = e.factors;
      if (fs[0].k === "num" && fs[0].d === 1 && Math.abs(fs[0].n) === 1 && fs.length > 1) {
        if (fs[0].n < 0) sign = "−";
        fs = fs.slice(1);
      }
      const parts = fs.map((f, i) => {
        if (f.k === "add" || f.k === "div" || f.k === "neg") return `(${show(f)})`;
        if (f.k === "num" && (f.d !== 1 || (f.n < 0 && i > 0))) return `(${show(f)})`;
        return show(f);
      });
      let out = parts[0];
      for (let i = 1; i < parts.length; i++) {
        const needDot = /^\d/.test(parts[i]); // a number after anything needs a visible dot
        out += (needDot ? "·" : "") + parts[i];
      }
      return sign + out;
    }
    case "pow":
      return (atomic(e.base) ? show(e.base) : `(${show(e.base)})`) + sup(e.exp);
    case "div":
      return (atomic(e.num) ? show(e.num) : `(${show(e.num)})`) + "/" + (atomic(e.den) ? show(e.den) : `(${show(e.den)})`);
    case "sqrt":
      return "√" + (atomic(e.arg) ? show(e.arg) : `(${show(e.arg)})`);
  }
}

export const same = (a: Expr, b: Expr) => show(a) === show(b);

// ---------------------------------------------------------------------------
// Numeric evaluation
// ---------------------------------------------------------------------------
export type Env = Record<string, number>;

export function evaluate(e: Expr, env: Env): number {
  switch (e.k) {
    case "num": return e.n / e.d;
    case "var": return env[e.name] ?? NaN;
    case "add": return e.terms.reduce((s, t) => s + evaluate(t, env), 0);
    case "mul": return e.factors.reduce((s, t) => s * evaluate(t, env), 1);
    case "neg": return -evaluate(e.arg, env);
    case "pow": return Math.pow(evaluate(e.base, env), e.exp);
    case "div": {
      const den = evaluate(e.den, env);
      return den === 0 ? NaN : evaluate(e.num, env) / den;
    }
    case "sqrt": {
      const a = evaluate(e.arg, env);
      return a < 0 ? NaN : Math.sqrt(a);
    }
  }
}

const mod = (a: number, m: number) => ((a % m) + m) % m;
function modPow(b: number, e: number, m: number): number {
  let r = 1 % m;
  b = mod(b, m);
  while (e > 0) {
    if (e % 2 === 1) r = (r * b) % m;
    b = (b * b) % m;
    e = Math.floor(e / 2);
  }
  return r;
}

/** Integer evaluation mod m (m < 2^26 so products stay exact). NaN when not an integer expression. */
export function evaluateMod(e: Expr, env: Env, m: number): number {
  switch (e.k) {
    case "num": return e.d === 1 ? mod(e.n, m) : NaN;
    case "var": return Number.isInteger(env[e.name]) ? mod(env[e.name], m) : NaN;
    case "add": return e.terms.reduce((s, t) => mod(s + evaluateMod(t, env, m), m), 0);
    case "mul": return e.factors.reduce((s, t) => mod(s * evaluateMod(t, env, m), m), 1 % m);
    case "neg": return mod(-evaluateMod(e.arg, env, m), m);
    case "pow": return modPow(evaluateMod(e.base, env, m), e.exp, m);
    default: return NaN;
  }
}

/** Replace every subtree that prints the same as `from`. */
export function replace(e: Expr, from: Expr, to: Expr): Expr {
  if (same(e, from)) return to;
  switch (e.k) {
    case "add": return add(e.terms.map((t) => replace(t, from, to)), true);
    case "mul": return mul(e.factors.map((t) => replace(t, from, to)), true);
    case "neg": return neg(replace(e.arg, from, to));
    case "sqrt": return sqrt(replace(e.arg, from, to));
    case "pow": return { k: "pow", base: replace(e.base, from, to), exp: e.exp };
    case "div": return { k: "div", num: replace(e.num, from, to), den: replace(e.den, from, to) };
    default: return e;
  }
}

// ---------------------------------------------------------------------------
// LaTeX (for KaTeX). Mirrors `show`: same tree, same grouping, so what is rendered is
// exactly what is checked. Each top-level term/factor is rendered separately by the UI.
// ---------------------------------------------------------------------------
export function toLatex(e: Expr): string {
  switch (e.k) {
    case "num":
      return (e.n < 0 ? "-" : "") + (e.d === 1 ? String(Math.abs(e.n)) : `\\tfrac{${Math.abs(e.n)}}{${e.d}}`);
    case "var":
      return e.name;
    case "neg":
      return "-" + (e.arg.k === "add" || e.arg.k === "neg" || (e.arg.k === "num" && e.arg.n < 0) ? `\\left(${toLatex(e.arg)}\\right)` : toLatex(e.arg));
    case "add":
      return e.terms
        .map((t, i) => {
          const [minus, body] = splitSign(t);
          const s = body.k === "add" ? `\\left(${toLatex(body)}\\right)` : toLatex(body);
          return i === 0 ? (minus ? "-" : "") + s : (minus ? " - " : " + ") + s;
        })
        .join("");
    case "mul": {
      let sign = "";
      let fs = e.factors;
      if (fs[0].k === "num" && fs[0].d === 1 && Math.abs(fs[0].n) === 1 && fs.length > 1) {
        if (fs[0].n < 0) sign = "-";
        fs = fs.slice(1);
      }
      const parts = fs.map((f, i) => {
        if (f.k === "add" || f.k === "div" || f.k === "neg") return `\\left(${toLatex(f)}\\right)`;
        if (f.k === "num" && (f.d !== 1 || (f.n < 0 && i > 0))) return `\\left(${toLatex(f)}\\right)`;
        return toLatex(f);
      });
      let out = parts[0];
      for (let i = 1; i < parts.length; i++) out += (/^\d/.test(parts[i]) ? " \\cdot " : "") + parts[i];
      return sign + out;
    }
    case "pow":
      return (atomic(e.base) ? toLatex(e.base) : `\\left(${toLatex(e.base)}\\right)`) + `^{${e.exp}}`;
    case "div":
      return `\\frac{${toLatex(e.num)}}{${toLatex(e.den)}}`;
    case "sqrt":
      return `\\sqrt{${toLatex(e.arg)}}`;
  }
}

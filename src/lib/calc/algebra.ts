// Algebra: quadratic equations, systems of linear equations, arithmetic and geometric series.
import { rAdd, rDiv, rMul, rSub } from "@/lib/learn/math/rational";
import {
  CalcError, R0, R1, babs, bgcd, blcm, bsqrt, checkSize, fmtInt, fr, frP, isBlank, isInt, m, rCmp, rPow, rat, readInt, readRat,
  type CalcResult, type Rational, type Step, type Tool,
} from "./core";
import { factorize } from "./number-theory";

// ---- shared formatting -------------------------------------------------------------------

/** A linear combination like 2x - y + \frac{1}{2}z (zero terms dropped; all zero gives 0). */
export function termsStr(coeffs: Rational[], vars: string[]): string {
  let out = "";
  coeffs.forEach((c, k) => {
    if (c.n === 0n) return;
    const neg = c.n < 0n;
    const a = rat(babs(c.n), c.d);
    const body = (a.n === 1n && a.d === 1n ? "" : fr(a)) + vars[k];
    out += out ? (neg ? ` - ${body}` : ` + ${body}`) : neg ? `-${body}` : body;
  });
  return out || "0";
}

function polyStr(a: bigint, b: bigint, c: bigint): string {
  const t = termsStr([rat(a), rat(b)], ["x^{2}", "x"]);
  if (c === 0n) return t;
  return `${t} ${c < 0n ? "-" : "+"} ${fmtInt(babs(c))}`;
}

/** Largest k with k^2 dividing n (n > 0): returns [k, n / k^2]. */
function splitSquare(n: bigint): [bigint, bigint] {
  let k = 1n;
  let s = 1n;
  for (const [p, e] of factorize(n)) {
    k *= p ** BigInt(Math.floor(e / 2));
    if (e % 2) s *= p;
  }
  return [k, s];
}

/** Six significant figures, never in exponent form. */
const approx = (x: number) => Number(x.toPrecision(6)).toLocaleString("en-US", { useGrouping: false, maximumFractionDigits: 12 });

// ---- quadratic --------------------------------------------------------------------------

/** "qx - p" for the root p/q (q > 0). */
function linFactor(r: Rational): string {
  const q = r.d === 1n ? "" : fmtInt(r.d);
  if (r.n === 0n) return `${q}x`;
  return `${q}x ${r.n > 0n ? "-" : "+"} ${fmtInt(babs(r.n))}`;
}

const quadTool: Tool = {
  id: "quadratic",
  domain: "Algebra",
  name: "Quadratic equation",
  blurb: "Solve ax² + bx + c = 0 exactly: discriminant, simplified radicals, factoring and Vieta.",
  fields: [
    { key: "a", label: "a (x² coefficient)", placeholder: "e.g. 2" },
    { key: "b", label: "b (x coefficient)", placeholder: "e.g. -3" },
    { key: "c", label: "c (constant)", placeholder: "e.g. -5" },
  ],
  example: { a: "1", b: "-6", c: "4" },
  run(v): CalcResult {
    const ra = readRat(v.a, "a");
    const rb = readRat(v.b, "b");
    const rc = readRat(v.c, "c");
    if (ra.n === 0n) throw new CalcError("a can't be 0: then it's a linear equation, not a quadratic.");
    const steps: Step[] = [];
    const orig = `${termsStr([ra, rb], ["x^{2}", "x"])}${rc.n === 0n ? "" : ` ${rc.n < 0n ? "-" : "+"} ${fr(rat(babs(rc.n), rc.d))}`} = 0`;
    steps.push({ title: "Start", lines: [m(orig)] });

    // Make the coefficients whole numbers with no common factor, and a > 0.
    const L = blcm(blcm(ra.d, rb.d), rc.d);
    let [a, b, c] = [ra, rb, rc].map((r) => r.n * (L / r.d));
    const lines: string[] = [];
    if (L !== 1n) lines.push(`Multiply both sides by ${fmtInt(L)} to clear the fractions: ${m(`${polyStr(a, b, c)} = 0`)}.`);
    let g = bgcd(bgcd(a, b), c);
    if (a < 0n) g = -g;
    if (g !== 1n) {
      [a, b, c] = [a / g, b / g, c / g];
      lines.push(`Divide both sides by ${fmtInt(g)}: ${m(`${polyStr(a, b, c)} = 0`)}.`);
    }
    if (lines.length) steps.push({ title: "Tidy the coefficients", lines });
    if ([a, b, c].some((x) => babs(x) > 100000n)) throw new CalcError("The coefficients are too large for this tool (after clearing fractions, keep them under 100,000).");

    const D = b * b - 4n * a * c;
    steps.push({
      title: "Discriminant",
      lines: [
        `${m(`a = ${fmtInt(a)}`)}, ${m(`b = ${fmtInt(b)}`)}, ${m(`c = ${fmtInt(c)}`)}. The discriminant ${m(`b^{2} - 4ac`)} decides what kind of roots there are.`,
        m(`${b < 0n ? `(${fmtInt(b)})` : fmtInt(b)}^{2} - 4 \\cdot ${fmtInt(a)} \\cdot ${c < 0n ? `(${fmtInt(c)})` : fmtInt(c)} = ${fmtInt(b * b)} ${4n * a * c < 0n ? "+" : "-"} ${fmtInt(babs(4n * a * c))} = ${fmtInt(D)}`),
      ],
    });

    const twoA = 2n * a;
    const negB = fmtInt(-b);
    let answer: string;
    if (D >= 0n && bsqrt(D) ** 2n === D) {
      const s = bsqrt(D);
      const r1 = rat(-b + s, twoA);
      const r2 = rat(-b - s, twoA);
      if (D === 0n) {
        steps.push({
          title: "One repeated root",
          lines: [`The discriminant is 0, so ${m(`x = \\frac{-b}{2a} = \\frac{${negB}}{${fmtInt(twoA)}} = ${fr(r1)}`)} (a double root).`, `Factored: ${m(`(${linFactor(r1)})^{2} = 0`)}.`],
        });
        answer = m(`x = ${fr(r1)}`) + " (double root)";
      } else {
        steps.push({
          title: "Quadratic formula",
          lines: [
            `${m(`${fmtInt(D)} = ${fmtInt(s)}^{2}`)} is a perfect square, so the roots are rational.`,
            m(`x = \\frac{-b \\pm \\sqrt{b^{2} - 4ac}}{2a} = \\frac{${negB} \\pm ${fmtInt(s)}}{${fmtInt(twoA)}}`),
            `${m(`x = \\frac{${fmtInt(-b + s)}}{${fmtInt(twoA)}} = ${fr(r1)}`)} or ${m(`x = \\frac{${fmtInt(-b - s)}}{${fmtInt(twoA)}} = ${fr(r2)}`)}`,
          ],
        });
        steps.push({ title: "Factored form", lines: [`Each root ${m("p/q")} gives a factor ${m("(qx - p)")}: ${m(`(${linFactor(r1)})(${linFactor(r2)}) = 0`)}.`] });
        answer = `${m(`x = ${fr(r1)}`)} or ${m(`x = ${fr(r2)}`)}`;
      }
    } else {
      const [k, sq] = splitSquare(babs(D));
      const i = D < 0n ? "i" : "";
      const rad = sq === 1n ? "" : `\\sqrt{${fmtInt(sq)}}`;
      const radLines: string[] = [];
      if (D < 0n) radLines.push(`The discriminant is negative, so there are **no real roots**. Using ${m("i = \\sqrt{-1}")} gives the complex roots:`);
      radLines.push(
        m(`\\sqrt{${fmtInt(D)}} = ${k !== 1n ? `\\sqrt{${fmtInt(k * k)} \\cdot ${fmtInt(sq)}}${D < 0n ? " \\cdot i" : ""} = ` : ""}${k === 1n ? "" : fmtInt(k)}${rad}${i}`),
      );
      // Reduce (-b ± k·rad)/(2a) by the common factor.
      const gg = bgcd(bgcd(b, k), twoA);
      const [nb, nk, nd] = [-b / gg, k / gg, twoA / gg];
      const surd = `${nk === 1n ? "" : fmtInt(nk)}${rad}${i}` || "1";
      const top = nb === 0n ? `\\pm ${surd}` : `${fmtInt(nb)} \\pm ${surd}`;
      const shown = nd === 1n ? top : `\\frac{${top}}{${fmtInt(nd)}}`;
      const formula = m(`x = \\frac{${negB} \\pm ${k === 1n ? "" : fmtInt(k)}${rad}${i}}{${fmtInt(twoA)}}`);
      radLines.push(formula);
      if (gg !== 1n) radLines.push(`Divide the top and bottom by ${fmtInt(gg)}: ${m(`x = ${shown}`)}`);
      if (D > 0n) {
        const sqrtD = Math.sqrt(Number(D));
        const x1 = (-Number(b) + sqrtD) / Number(twoA);
        const x2 = (-Number(b) - sqrtD) / Number(twoA);
        radLines.push(`Approximately ${m(`x \\approx ${approx(x1)}`)} or ${m(`x \\approx ${approx(x2)}`)}.`);
      }
      steps.push({ title: D < 0n ? "Complex roots" : "Simplify the square root", lines: radLines });
      answer = m(`x = ${shown}`) + (D < 0n ? " (no real roots)" : "");
    }

    const sum = rat(-b, a);
    const prod = rat(c, a);
    steps.push({
      title: "Check with Vieta's formulas",
      lines: [`For any quadratic, the roots add to ${m("-\\frac{b}{a}")} and multiply to ${m("\\frac{c}{a}")}. Here the sum is ${m(fr(sum))} and the product is ${m(fr(prod))}. Many contest questions only need these.`],
    });
    return { steps, answer };
  },
};

// ---- linear systems -----------------------------------------------------------------------

interface Eq { c: bigint[]; r: bigint }

function parseSide(side: string, vars: Map<string, Rational>, line: string): Rational {
  // Returns the constant; adds variable coefficients into `vars`.
  let constant = R0;
  const s = side.replace(/\s+/g, "").replace(/[−–]/g, "-").replace(/[·×]/g, "*");
  if (!s) throw new CalcError(`One side of “${line}” is empty.`);
  const re = /([+-]?)(\d+(?:\.\d+)?(?:\/\d+)?|\.\d+)?\*?([a-zA-Z])?/y;
  let i = 0;
  while (i < s.length) {
    re.lastIndex = i;
    const mm = re.exec(s);
    if (!mm || mm[0] === "" || (!mm[2] && !mm[3])) throw new CalcError(`I can't read “${line}”. Write equations like 2x + 3y = 7 (no brackets).`);
    i = re.lastIndex;
    let coef = R1;
    if (mm[2]) {
      const [num, den] = mm[2].split("/");
      const [w, f = ""] = num.split(".");
      coef = rat(BigInt((w || "0") + f), 10n ** BigInt(f.length) * BigInt(den ?? "1"));
      if (den === "0") throw new CalcError(`“${line}” divides by zero.`);
    }
    if (mm[1] === "-") coef = rat(-coef.n, coef.d);
    if (mm[3]) {
      const name = mm[3].toLowerCase();
      vars.set(name, rAdd(vars.get(name) ?? R0, coef));
    } else constant = rAdd(constant, coef);
    if (i < s.length && !/[+-]/.test(s[i])) throw new CalcError(`I can't read “${line}”. Put + or − between terms, and use single letters for unknowns.`);
  }
  return constant;
}

export function parseSystem(text: string): { vars: string[]; rows: { c: Rational[]; r: Rational }[]; lines: string[] } {
  const lines = text.split(/\n|;/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 1) throw new CalcError("Enter one equation per line, e.g. 2x + 3y = 7.");
  if (lines.length > 4) throw new CalcError("Enter at most four equations.");
  const parsed = lines.map((line) => {
    const sides = line.split("=");
    if (sides.length !== 2) throw new CalcError(`“${line}” needs exactly one “=”.`);
    const left = new Map<string, Rational>();
    const right = new Map<string, Rational>();
    const lc = parseSide(sides[0], left, line);
    const rc = parseSide(sides[1], right, line);
    // Move variables left, constants right.
    for (const [k, val] of right) left.set(k, rSub(left.get(k) ?? R0, val));
    return { coeffs: left, r: rSub(rc, lc) };
  });
  const vars = [...new Set(parsed.flatMap((p) => [...p.coeffs.keys()]))].sort();
  if (!vars.length) throw new CalcError("There are no unknowns (letters) in these equations.");
  if (vars.length > 4) throw new CalcError("Use at most four unknowns.");
  return { vars, rows: parsed.map((p) => ({ c: vars.map((x) => p.coeffs.get(x) ?? R0), r: p.r })), lines };
}

const eqStr = (e: Eq, vars: string[]) => `${termsStr(e.c.map((x) => rat(x)), vars)} = ${fmtInt(e.r)}`;
const label = (k: number) => `E_{${k + 1}}`;

/** Divide a row by the gcd of its entries, and make its first nonzero coefficient positive. */
function tidy(e: Eq): Eq {
  let g = [...e.c, e.r].reduce((a, x) => bgcd(a, x), 0n);
  if (g === 0n) return e;
  const lead = e.c.find((x) => x !== 0n) ?? e.r;
  if (lead < 0n) g = -g;
  return { c: e.c.map((x) => x / g), r: e.r / g };
}

const systemTool: Tool = {
  id: "system",
  domain: "Algebra",
  name: "System of linear equations",
  blurb: "Solve up to four equations by elimination, with whole-number row operations.",
  fields: [{ key: "eqs", label: "Equations, one per line", kind: "lines", placeholder: "2x + 3y = 7\nx - y = 1", hint: "Single-letter unknowns. Fractions and decimals are fine: x/2 must be written 1/2x." }],
  example: { eqs: "x + y + z = 6\n2x - y + z = 3\nx + 2y - z = 2" },
  run(v): CalcResult {
    const { vars, rows: raw } = parseSystem(v.eqs ?? "");
    const steps: Step[] = [];
    // Clear fractions so every row is whole numbers.
    const rows: Eq[] = raw.map((row) => {
      const L = [...row.c, row.r].reduce((a, x) => blcm(a, x.d), 1n);
      return tidy({ c: row.c.map((x) => x.n * (L / x.d)), r: row.r.n * (L / row.r.d) });
    });
    if ([...rows.flatMap((r) => r.c), ...rows.map((r) => r.r)].some((x) => babs(x) > 10n ** 9n)) throw new CalcError("The numbers are too large for this tool.");
    steps.push({
      title: "Write each equation in standard form",
      lines: [`Unknowns on the left, numbers on the right, fractions cleared:`, ...rows.map((e, k) => `${m(label(k))}: ${m(eqStr(e, vars))}`)],
    });

    const pivotOf: number[] = []; // pivotOf[col] = row index, or -1 if the variable is free
    const used = new Set<number>();
    for (let col = 0; col < vars.length; col++) {
      const candidates = rows.map((e, k) => k).filter((k) => !used.has(k) && rows[k].c[col] !== 0n);
      if (!candidates.length) {
        pivotOf[col] = -1;
        continue;
      }
      const p = candidates.sort((x, y) => {
        const ax = babs(rows[x].c[col]);
        const ay = babs(rows[y].c[col]);
        return ax === ay ? x - y : ax < ay ? -1 : 1;
      })[0];
      used.add(p);
      pivotOf[col] = p;
      const lines: string[] = [];
      for (let k = 0; k < rows.length; k++) {
        if (k === p || rows[k].c[col] === 0n) continue;
        const pc = rows[p].c[col];
        const kc = rows[k].c[col];
        const g = bgcd(pc, kc);
        let mk = pc / g; // multiply row k by mk, subtract mp·row p
        let mp = kc / g;
        if (mk < 0n) [mk, mp] = [-mk, -mp];
        const combined: Eq = { c: rows[k].c.map((x, j) => mk * x - mp * rows[p].c[j]), r: mk * rows[k].r - mp * rows[p].r };
        const next = tidy(combined);
        const opText = `${mk === 1n ? "" : fmtInt(mk)}${label(k)} ${mp < 0n ? "+" : "-"} ${babs(mp) === 1n ? "" : fmtInt(babs(mp))}${label(p)}`;
        lines.push(`Replace ${m(label(k))} with ${m(opText)}: ${m(eqStr(next, vars))}` + (next.r !== combined.r || next.c.some((x, j) => x !== combined.c[j]) ? " (after dividing out a common factor)" : ""));
        rows[k] = next;
      }
      if (lines.length) {
        steps.push({
          title: `Eliminate ${vars[col]}`,
          lines: [`Use ${m(label(p))} to remove ${m(vars[col])} from the other equations: multiply so the ${m(vars[col])} coefficients match, then subtract.`, ...lines],
        });
      }
    }

    const bad = rows.findIndex((e) => e.c.every((x) => x === 0n) && e.r !== 0n);
    if (bad >= 0) {
      steps.push({ title: "Contradiction", lines: [`${m(label(bad))} became ${m(`0 = ${fmtInt(rows[bad].r)}`)}, which is impossible. The equations contradict each other.`] });
      return { steps, answer: "No solution" };
    }
    const free = vars.filter((_, col) => pivotOf[col] === -1);
    if (free.length) {
      const lines = vars
        .map((x, col) => {
          const p = pivotOf[col];
          if (p === -1) return null;
          const e = rows[p];
          const rest = e.c.map((cv, j) => (j === col ? R0 : rat(-cv, e.c[col])));
          const rhs = termsStr(rest, vars);
          const constant = rat(e.r, e.c[col]);
          const body = rhs === "0" ? fr(constant) : constant.n === 0n ? rhs : `${fr(constant)} ${rhs.startsWith("-") ? `- ${rhs.slice(1)}` : `+ ${rhs}`}`;
          return m(`${x} = ${body}`);
        })
        .filter((s): s is string => !!s);
      steps.push({
        title: "Infinitely many solutions",
        lines: [`There are more unknowns than independent equations, so ${free.map((f) => m(f)).join(" and ")} can be anything. The others depend on ${free.length > 1 ? "them" : "it"}:`, ...lines],
      });
      return { steps, answer: `Infinitely many solutions (${free.join(", ")} free)` };
    }
    const sol = vars.map((_, col) => rat(rows[pivotOf[col]].r, rows[pivotOf[col]].c[col]));
    steps.push({
      title: "Solve each equation",
      lines: vars.map((x, col) => {
        const e = rows[pivotOf[col]];
        const cf = e.c[col];
        return cf === 1n ? m(`${x} = ${fr(sol[col])}`) : m(`${fmtInt(cf)}${x} = ${fmtInt(e.r)} \\to ${x} = ${fr(sol[col])}`);
      }),
    });
    steps.push({
      title: "Check",
      lines: raw.map((row) => {
        const lhs = row.c.map((cf, j) => rMul(cf, sol[j])).reduce(rAdd, R0);
        const shown = row.c.map((cf, j) => (cf.n === 0n ? null : `${cf.n === 1n && cf.d === 1n ? "" : cf.n === -1n && cf.d === 1n ? "-" : fr(cf)}(${fr(sol[j])})`)).filter(Boolean).join(" + ").replace(/\+ -/g, "- ");
        return `${m(`${shown} = ${fr(lhs)}`)} ${rCmp(lhs, row.r) === 0 ? "✓" : "✗"}`;
      }),
    });
    return { steps, answer: m(vars.map((x, col) => `${x} = ${fr(sol[col])}`).join(", \\text{ }")) };
  },
};

// ---- series -----------------------------------------------------------------------------

const arithTool: Tool = {
  id: "arith-series",
  domain: "Algebra",
  name: "Arithmetic series",
  blurb: "Sum of a list with a constant difference, e.g. 5 + 8 + 11 + … + 302.",
  fields: [
    { key: "a", label: "First term", placeholder: "e.g. 5" },
    { key: "d", label: "Common difference", placeholder: "e.g. 3" },
    { key: "n", label: "Number of terms", placeholder: "e.g. 100", optional: true, hint: "Give the number of terms or the last term." },
    { key: "last", label: "Last term", placeholder: "e.g. 302", optional: true },
  ],
  example: { a: "5", d: "3", n: "", last: "302" },
  run(v): CalcResult {
    const a = readRat(v.a, "the first term");
    const d = readRat(v.d, "the common difference");
    const steps: Step[] = [];
    let n: bigint;
    let last: Rational;
    if (!isBlank(v.n)) {
      n = readInt(v.n, "the number of terms", { min: 1n, max: 10n ** 12n });
      last = rAdd(a, rMul(rat(n - 1n), d));
      steps.push({ title: "Find the last term", lines: [`The ${fmtInt(n)}th term is the first plus ${fmtInt(n - 1n)} differences:`, m(`${fr(a)} + (${fmtInt(n)} - 1) \\cdot ${frP(d)} = ${fr(last)}`)] });
      if (!isBlank(v.last) && rCmp(readRat(v.last, "the last term"), last) !== 0) {
        throw new CalcError(`With ${fmtInt(n)} terms the last term is ${fr(last).replace(/\\frac\{(.+?)\}\{(.+?)\}/, "$1/$2")}, not ${v.last!.trim()}. Fill in only one of the two.`);
      }
    } else if (!isBlank(v.last)) {
      last = readRat(v.last, "the last term");
      if (d.n === 0n) throw new CalcError("With a difference of 0 every term is the same; give the number of terms instead.");
      const k = rDiv(rSub(last, a), d);
      if (!isInt(k) || k.n < 0n) throw new CalcError(`Starting at ${v.a!.trim()} and adding ${v.d!.trim()} each time never lands exactly on ${v.last!.trim()}.`);
      n = k.n + 1n;
      steps.push({
        title: "Count the terms",
        lines: [`Count the steps from first to last and add 1 (the first term itself):`, m(`\\frac{${fr(last)} - ${frP(a)}}{${fr(d)}} + 1 = ${fmtInt(k.n)} + 1 = ${fmtInt(n)}`)],
      });
    } else throw new CalcError("Give the number of terms or the last term.");
    const sum = rDiv(rMul(rat(n), rAdd(a, last)), rat(2));
    steps.push({
      title: "Average times count",
      lines: [`The terms are evenly spaced, so their average is the average of the first and last. The sum is that average times the number of terms:`, m(`\\frac{(${fr(a)} + ${fr(last)}) \\cdot ${fmtInt(n)}}{2} = \\frac{${fr(rAdd(a, last))} \\cdot ${fmtInt(n)}}{2} = ${fr(sum)}`)],
    });
    return { steps, answer: `Sum ${m(`= ${fr(sum)}`)} (${fmtInt(n)} terms)` };
  },
};

const geoTool: Tool = {
  id: "geo-series",
  domain: "Algebra",
  name: "Geometric series",
  blurb: "Sum of a list where each term is the last times r, finite or infinite.",
  fields: [
    { key: "a", label: "First term", placeholder: "e.g. 3" },
    { key: "r", label: "Ratio r", placeholder: "e.g. 2 or 1/3" },
    { key: "n", label: "Number of terms", placeholder: "e.g. 10, or ∞", hint: "Type ∞ or inf for an infinite series (needs −1 < r < 1)." },
  ],
  example: { a: "3", r: "2", n: "10" },
  run(v): CalcResult {
    const a = readRat(v.a, "the first term");
    const r = readRat(v.r, "the ratio");
    const steps: Step[] = [];
    const nRaw = (v.n ?? "").trim().toLowerCase();
    if (/^(∞|inf|infinity|infinite)$/.test(nRaw)) {
      if (!(rCmp(r, rat(-1)) > 0 && rCmp(r, R1) < 0)) {
        steps.push({ title: "It doesn't add up to a number", lines: [`An infinite geometric series has a sum only when ${m("-1 < r < 1")}; otherwise the terms don't shrink to 0.`] });
        return { steps, answer: "No finite sum (the series diverges)" };
      }
      const sum = rDiv(a, rSub(R1, r));
      steps.push({
        title: "Infinite sum formula",
        lines: [`If ${m("S = a + ar + ar^{2} + \\dots")} then ${m("rS")} is the same list without its first term, so ${m("S - rS = a")}:`, m(`S = \\frac{a}{1 - r} = \\frac{${fr(a)}}{1 - ${frP(r)}} = \\frac{${fr(a)}}{${fr(rSub(R1, r))}} = ${fr(sum)}`)],
      });
      return { steps, answer: m(`S = ${fr(sum)}`) };
    }
    const n = readInt(v.n, "the number of terms", { min: 1n, max: 400n });
    if (r.n === 1n && r.d === 1n) {
      const sum = rMul(a, rat(n));
      steps.push({ title: "Ratio 1", lines: [`Every term equals ${m(fr(a))}, so the sum is ${m(`${fmtInt(n)} \\cdot ${frP(a)} = ${fr(sum)}`)}.`] });
      return { steps, answer: m(`S = ${fr(sum)}`) };
    }
    const rn = rPow(r, n);
    checkSize(rn, "r^n");
    const sum = rDiv(rMul(a, rSub(R1, rn)), rSub(R1, r));
    checkSize(sum);
    steps.push({
      title: "Formula",
      lines: [`Subtract ${m("rS")} from ${m("S")}: everything cancels except the first term and the term after the last, so ${m("S = a \\cdot \\frac{1 - r^{n}}{1 - r}")}.`],
    });
    steps.push({ title: `Compute r^n`, lines: [m(`${frP(r)}^{${fmtInt(n)}} = ${fr(rn)}`)] });
    steps.push({
      title: "Substitute",
      lines: [m(`S = ${frP(a)} \\cdot \\frac{1 - ${frP(rn)}}{1 - ${frP(r)}} = ${frP(a)} \\cdot \\frac{${fr(rSub(R1, rn))}}{${fr(rSub(R1, r))}} = ${fr(sum)}`)],
    });
    return { steps, answer: m(`S = ${fr(sum)}`) };
  },
};

export const ALGEBRA_TOOLS: Tool[] = [quadTool, systemTool, arithTool, geoTool];

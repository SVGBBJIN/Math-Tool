// Number theory: prime factorization, GCD/LCM, divisors, powers mod m.
import { CalcError, bgcd, blcm, bmod, fmtInt, m, readInt, type CalcResult, type Step, type Tool } from "./core";

const MAX_FACTOR = 10n ** 12n;

/** p^e as markup (exponent 1 is left off). */
const pe = (p: bigint, e: number) => (e === 1 ? `${p}` : `${p}^{${e}}`);
export const factorString = (fs: [bigint, number][]) => fs.map(([p, e]) => pe(p, e)).join(" \\cdot ");

/** Trial division. n must be in [2, 10^12]. */
export function factorize(n: bigint): [bigint, number][] {
  const out: [bigint, number][] = [];
  let r = n;
  for (let p = 2n; p * p <= r; p += p === 2n ? 1n : 2n) {
    let e = 0;
    while (r % p === 0n) {
      r /= p;
      e++;
    }
    if (e) out.push([p, e]);
  }
  if (r > 1n) out.push([r, 1]);
  return out;
}

/** Trim a long list of lines to its first few and last one. */
function trimLines(lines: string[], keep = 4): string[] {
  return lines.length <= keep + 2 ? lines : [...lines.slice(0, keep), `… (${lines.length - keep - 1} more divisions) …`, lines[lines.length - 1]];
}

function factorSteps(n: bigint): { steps: Step[]; fs: [bigint, number][] } {
  const steps: Step[] = [];
  const fs: [bigint, number][] = [];
  let r = n;
  const soFar = () => {
    const known = factorString(fs);
    return r === 1n ? known : `${known} \\cdot ${fmtInt(r)}`;
  };
  steps.push({
    title: "Plan",
    lines: [`Divide by the primes 2, 3, 5, 7, … in order, as many times as each one goes in. Only primes up to the square root of what is left need to be tried.`],
  });
  let p = 2n;
  for (; p * p <= r; p += p === 2n ? 1n : 2n) {
    if (r % p !== 0n) continue;
    const lines: string[] = [];
    let e = 0;
    while (r % p === 0n) {
      lines.push(m(`${fmtInt(r)} \\div ${p} = ${fmtInt(r / p)}`));
      r /= p;
      e++;
    }
    fs.push([p, e]);
    steps.push({ title: `Divide out ${p}`, lines: [...trimLines(lines), `So far: ${m(`${fmtInt(n)} = ${soFar()}`)}`] });
  }
  if (r > 1n) {
    fs.push([r, 1]);
    const next = p;
    steps.push({
      title: `${fmtInt(r)} is prime`,
      lines: [
        r === n
          ? `No prime up to ${m(`\\sqrt{${fmtInt(n)}}`)} divides ${fmtInt(n)}, so it has no smaller factor.`
          : `${fmtInt(r)} is left. Every prime up to its square root has been tried (the next one, ${next}, has ${m(`${next}^{2} = ${fmtInt(next * next)} > ${fmtInt(r)}`)}), and none divides it, so ${fmtInt(r)} is prime.`,
      ],
    });
  }
  return { steps, fs };
}

const factorTool: Tool = {
  id: "factor",
  domain: "Number theory",
  name: "Prime factorization",
  blurb: "Break a number into primes by repeated division.",
  fields: [{ key: "n", label: "Number", placeholder: "e.g. 3600" }],
  example: { n: "2520" },
  run(v): CalcResult {
    const n = readInt(v.n, "the number", { min: 2n, max: MAX_FACTOR });
    const { steps, fs } = factorSteps(n);
    return { steps, answer: m(`${fmtInt(n)} = ${factorString(fs)}`) };
  },
};

// ---- GCD and LCM ------------------------------------------------------------------------

export function readList(raw: string | undefined, label: string, min: bigint, max: bigint): bigint[] {
  const parts = (raw ?? "").split(/[,;\s]+/).filter(Boolean);
  if (parts.length < 2) throw new CalcError(`Enter at least two ${label}, separated by commas.`);
  if (parts.length > 6) throw new CalcError(`Enter at most six ${label}.`);
  return parts.map((s) => readInt(s, `each of the ${label}`, { min, max }));
}

function euclid(a: bigint, b: bigint): { lines: string[]; g: bigint } {
  const lines: string[] = [];
  let [x, y] = a >= b ? [a, b] : [b, a];
  while (y) {
    const q = x / y;
    const r = x % y;
    lines.push(m(`${fmtInt(x)} = ${fmtInt(q)} \\cdot ${fmtInt(y)} + ${fmtInt(r)}`));
    [x, y] = [y, r];
  }
  return { lines, g: x };
}

const gcdTool: Tool = {
  id: "gcd",
  domain: "Number theory",
  name: "GCD and LCM",
  blurb: "Greatest common divisor by the Euclidean algorithm, then the least common multiple.",
  fields: [{ key: "nums", label: "Numbers", placeholder: "e.g. 252, 198", hint: "Two to six positive whole numbers, separated by commas." }],
  example: { nums: "252, 198" },
  run(v): CalcResult {
    const nums = readList(v.nums, "numbers", 1n, 10n ** 18n);
    const steps: Step[] = [
      {
        title: "Euclidean algorithm",
        lines: [`Divide the larger number by the smaller and keep the remainder. Repeat with the divisor and the remainder. The last nonzero remainder is the GCD, because every step keeps the same common divisors.`],
      },
    ];
    let g = nums[0];
    for (let k = 1; k < nums.length; k++) {
      const { lines, g: g2 } = euclid(g, nums[k]);
      steps.push({
        title: nums.length === 2 ? `GCD(${fmtInt(nums[0])}, ${fmtInt(nums[1])})` : `GCD(${fmtInt(g)}, ${fmtInt(nums[k])})`,
        lines: [...lines, `The remainder is 0, so the GCD is **${fmtInt(g2)}**.`],
      });
      g = g2;
    }
    let l = nums[0];
    for (let k = 1; k < nums.length; k++) {
      const gg = bgcd(l, nums[k]);
      const l2 = blcm(l, nums[k]);
      steps.push({
        title: `LCM(${fmtInt(l)}, ${fmtInt(nums[k])})`,
        lines: [
          `Use ${m(`\\text{LCM}(a,\\text{ }b) = \\frac{a \\cdot b}{\\text{GCD}(a,\\text{ }b)}`)}.`,
          m(`\\frac{${fmtInt(l)} \\cdot ${fmtInt(nums[k])}}{${fmtInt(gg)}} = ${fmtInt(l2)}`),
        ],
      });
      l = l2;
    }
    const list = nums.map(fmtInt).join(",\\text{ }");
    return { steps, answer: `${m(`\\text{GCD}(${list}) = ${fmtInt(g)}`)}, ${m(`\\text{LCM}(${list}) = ${fmtInt(l)}`)}` };
  },
};

// ---- divisors ---------------------------------------------------------------------------

const divisorsTool: Tool = {
  id: "divisors",
  domain: "Number theory",
  name: "Divisors: count and sum",
  blurb: "How many divisors a number has and what they add up to, from its prime factorization.",
  fields: [{ key: "n", label: "Number", placeholder: "e.g. 720" }],
  example: { n: "720" },
  run(v): CalcResult {
    const n = readInt(v.n, "the number", { min: 2n, max: MAX_FACTOR });
    const fs = factorize(n);
    const steps: Step[] = [{ title: "Prime factorization", lines: [m(`${fmtInt(n)} = ${factorString(fs)}`), "(The Prime factorization tool shows the divisions.)"] }];

    const count = fs.reduce((a, [, e]) => a * (e + 1), 1);
    steps.push({
      title: "Count the divisors",
      lines: [
        `A divisor uses each prime with any exponent from 0 up to its exponent in ${fmtInt(n)}. ` +
          fs.map(([p, e]) => `For ${p}: ${e + 1} choices (0 to ${e}).`).join(" "),
        m(`${fs.map(([, e]) => `(${e} + 1)`).join("")} = ${fs.map(([, e]) => e + 1).join(" \\cdot ")} = ${count}`),
      ],
    });

    const sums = fs.map(([p, e]) => (p ** BigInt(e + 1) - 1n) / (p - 1n));
    const total = sums.reduce((a, b) => a * b, 1n);
    const factorTerm = ([p, e]: [bigint, number]) =>
      e <= 4 ? `(${Array.from({ length: e + 1 }, (_, k) => (k === 0 ? "1" : pe(p, k))).join(" + ")})` : `\\frac{${p}^{${e + 1}} - 1}{${p} - 1}`;
    steps.push({
      title: "Add the divisors",
      lines: [
        `Multiplying out one bracket per prime produces every divisor exactly once:`,
        m(fs.map(factorTerm).join(" \\cdot ")),
        m(`= ${sums.map(fmtInt).join(" \\cdot ")} = ${fmtInt(total)}`),
      ],
    });

    if (count <= 60) {
      const divs: bigint[] = [];
      for (let d = 1n; d * d <= n; d++) if (n % d === 0n) divs.push(d);
      const all = [...divs, ...divs.map((d) => n / d).reverse()].filter((d, k, a) => k === 0 || d !== a[k - 1]);
      steps.push({ title: "The divisors", lines: [`Listed in pairs that multiply to ${fmtInt(n)}: ${all.map(fmtInt).join(", ")}.`] });
    }
    return { steps, answer: `${count} divisors, with sum ${fmtInt(total)}` };
  },
};

// ---- powers mod m -----------------------------------------------------------------------

const modPowTool: Tool = {
  id: "modpow",
  domain: "Number theory",
  name: "Power mod m (last digits)",
  blurb: "Find the remainder of a huge power, e.g. the last two digits of 7^2026 (use m = 100).",
  fields: [
    { key: "a", label: "Base a", placeholder: "e.g. 7" },
    { key: "b", label: "Exponent b", placeholder: "e.g. 2026" },
    { key: "m", label: "Modulus m", placeholder: "e.g. 100", hint: "m = 10 gives the last digit, m = 100 the last two digits." },
  ],
  example: { a: "7", b: "2026", m: "100" },
  run(v): CalcResult {
    const a = readInt(v.a, "the base", { min: -(10n ** 18n), max: 10n ** 18n });
    const b = readInt(v.b, "the exponent", { min: 0n, max: 10n ** 18n });
    const mod = readInt(v.m, "the modulus", { min: 2n, max: MAX_FACTOR });
    const pm = `\\pmod{${fmtInt(mod)}}`;
    const steps: Step[] = [];
    const a0 = bmod(a, mod);
    if (a0 !== a) {
      steps.push({ title: "Reduce the base", lines: [`Only the remainder of the base matters: ${m(`${fmtInt(a)} \\equiv ${fmtInt(a0)} ${pm}`)}.`] });
    }
    if (b === 0n) {
      steps.push({ title: "Exponent 0", lines: [`Any number to the power 0 is 1.`] });
      return { steps, answer: m(`${fmtInt(a)}^{0} \\equiv 1 ${pm}`) };
    }

    // Look for a cycle in a0^1, a0^2, … (works well for small moduli).
    const seq: bigint[] = [];
    const firstAt = new Map<bigint, number>();
    let x = a0;
    let repeatAt = -1;
    for (let k = 1; k <= 40; k++) {
      if (firstAt.has(x)) {
        repeatAt = k;
        break;
      }
      firstAt.set(x, k);
      seq.push(x);
      x = (x * a0) % mod;
    }
    const answer = (r: bigint) => m(`${fmtInt(a)}^{${fmtInt(b)}} \\equiv ${fmtInt(r)} ${pm}`);

    if (repeatAt > 0) {
      const start = firstAt.get(x)!; // exponent where the cycle begins
      const period = repeatAt - start;
      const lines = seq.map((val, k) => m(`${fmtInt(a0)}^{${k + 1}} \\equiv ${fmtInt(val)}`));
      lines.push(`${m(`${fmtInt(a0)}^{${repeatAt}} \\equiv ${fmtInt(x)}`)}, the same as ${m(`${fmtInt(a0)}^{${start}}`)}, so the remainders repeat every ${period} from exponent ${start} on.`);
      steps.push({ title: `List powers of ${fmtInt(a0)} ${"mod " + fmtInt(mod)}`, lines: [`Multiply by ${fmtInt(a0)} each time and keep only the remainder mod ${fmtInt(mod)}.`, ...lines] });
      if (b < BigInt(repeatAt)) {
        const r = seq[Number(b) - 1];
        steps.push({ title: "Read it off", lines: [`Exponent ${fmtInt(b)} is in the list: ${m(`${fmtInt(a0)}^{${b}} \\equiv ${fmtInt(r)}`)}.`] });
        return { steps, answer: answer(r) };
      }
      const off = b - BigInt(start);
      const q = off / BigInt(period);
      const rem = off % BigInt(period);
      const e = BigInt(start) + rem;
      const r = seq[Number(e) - 1];
      steps.push({
        title: "Use the cycle",
        lines: [
          start === 1
            ? `Divide the exponent by the cycle length ${period}: ${m(`${fmtInt(b)} - 1 = ${fmtInt(q)} \\cdot ${period} + ${rem}`)}.`
            : `Count from exponent ${start}: ${m(`${fmtInt(b)} - ${start} = ${fmtInt(q)} \\cdot ${period} + ${rem}`)}.`,
          `So ${m(`${fmtInt(a0)}^{${fmtInt(b)}}`)} has the same remainder as ${m(`${fmtInt(a0)}^{${e}}`)}, which is ${fmtInt(r)}.`,
        ],
      });
      return { steps, answer: answer(r) };
    }

    // Repeated squaring.
    const bits = b.toString(2);
    const parts: bigint[] = [];
    for (let k = 0; k < bits.length; k++) if (bits[bits.length - 1 - k] === "1") parts.push(1n << BigInt(k));
    steps.push({
      title: "Write the exponent in binary",
      lines: [`The remainders don't cycle quickly, so use repeated squaring.`, m(`${fmtInt(b)} = ${parts.map((p) => fmtInt(p)).reverse().join(" + ")}`)],
    });
    const sq: bigint[] = [a0];
    const sqLines = [m(`${fmtInt(a0)}^{1} \\equiv ${fmtInt(a0)}`)];
    for (let k = 1; k < bits.length; k++) {
      const prev = sq[k - 1];
      const val = (prev * prev) % mod;
      sq.push(val);
      sqLines.push(m(`${fmtInt(a0)}^{${fmtInt(1n << BigInt(k))}} \\equiv ${fmtInt(prev)}^{2} = ${fmtInt(prev * prev)} \\equiv ${fmtInt(val)}`));
    }
    steps.push({ title: "Square repeatedly", lines: [`Each line squares the one before, mod ${fmtInt(mod)}.`, ...sqLines] });
    let acc = 1n;
    const mulLines: string[] = [];
    for (let k = 0; k < bits.length; k++) {
      if (bits[bits.length - 1 - k] !== "1") continue;
      const before = acc;
      acc = (acc * sq[k]) % mod;
      mulLines.push(m(`${fmtInt(before)} \\cdot ${fmtInt(sq[k])} = ${fmtInt(before * sq[k])} \\equiv ${fmtInt(acc)}`));
    }
    steps.push({ title: "Multiply the pieces you need", lines: [`Multiply the powers for the binary digits that are 1, reducing each time.`, ...mulLines] });
    return { steps, answer: answer(acc) };
  },
};

export const NUMBER_THEORY_TOOLS: Tool[] = [factorTool, gcdTool, divisorsTool, modPowTool];

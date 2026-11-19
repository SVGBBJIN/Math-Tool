// Counting: combinations and permutations, arrangements with repeated letters, and
// distributing identical items (stars and bars).
import { CalcError, factorial, fmtInt, m, readInt, type CalcResult, type Step, type Tool } from "./core";

const MAX_N = 1000n;

/** n(n-1)…(n-k+1) as markup, shortened in the middle when long. */
function fallingFactors(n: bigint, k: bigint): string {
  if (k === 0n) return "1";
  const fs: string[] = [];
  if (k <= 8n) for (let i = 0n; i < k; i++) fs.push(fmtInt(n - i));
  else fs.push(fmtInt(n), fmtInt(n - 1n), fmtInt(n - 2n), "\\dots", fmtInt(n - k + 1n));
  return fs.join(" \\cdot ");
}
function factorialFactors(k: bigint): string {
  return fallingFactors(k, k);
}

/** The running product: multiply one factor on top, divide one on the bottom; every partial result is whole. */
function runningChoose(n: bigint, k: bigint): { lines: string[]; value: bigint } {
  const lines: string[] = [];
  let c = 1n;
  for (let i = 1n; i <= k; i++) {
    const top = n - k + i;
    const next = (c * top) / i;
    lines.push(m(`${fmtInt(c)} \\cdot ${fmtInt(top)} \\div ${i} = ${fmtInt(next)}`));
    c = next;
  }
  const shown = lines.length <= 12 ? lines : [...lines.slice(0, 5), `… (${lines.length - 7} more) …`, ...lines.slice(-2)];
  return { lines: shown, value: c };
}

export function choose(n: bigint, k: bigint): bigint {
  if (k < 0n || k > n) return 0n;
  if (k > n - k) k = n - k;
  let c = 1n;
  for (let i = 1n; i <= k; i++) c = (c * (n - k + i)) / i;
  return c;
}

/** Steps for C(n, k), used by several tools. */
export function chooseSteps(n: bigint, k: bigint): { steps: Step[]; value: bigint } {
  const steps: Step[] = [];
  let kk = k;
  if (k > n - k) {
    kk = n - k;
    steps.push({ title: "Use symmetry", lines: [`Choosing ${k} to take is the same as choosing ${kk} to leave out: ${m(`\\binom{${n}}{${k}} = \\binom{${n}}{${kk}}`)}.`] });
  }
  if (kk === 0n) {
    steps.push({ title: "Nothing to choose", lines: [`There is exactly one way to choose nothing: ${m(`\\binom{${n}}{0} = 1`)}.`] });
    return { steps, value: 1n };
  }
  steps.push({
    title: "Write the formula",
    lines: [
      `Count ordered choices, then divide by the ${kk}! orders of the same group:`,
      m(`\\binom{${n}}{${kk}} = \\frac{${fallingFactors(n, kk)}}{${factorialFactors(kk)}}`),
    ],
  });
  const { lines, value } = runningChoose(n, kk);
  steps.push({
    title: "Multiply and divide in turn",
    lines: [`Multiply by one factor on top, then divide by the next number on the bottom. Each partial result is a whole number (it counts choices from fewer items), so the numbers stay small.`, ...lines],
  });
  return { steps, value };
}

const chooseTool: Tool = {
  id: "choose",
  domain: "Counting",
  name: "Combinations and permutations",
  blurb: "C(n, k): choose k from n when order doesn't matter. P(n, k): when it does.",
  fields: [
    { key: "kind", label: "Order", kind: "select", options: [["c", "Order doesn't matter: C(n, k)"], ["p", "Order matters: P(n, k)"]] },
    { key: "n", label: "n (items to choose from)", placeholder: "e.g. 10" },
    { key: "k", label: "k (how many to pick)", placeholder: "e.g. 4" },
  ],
  example: { kind: "c", n: "12", k: "5" },
  run(v): CalcResult {
    const n = readInt(v.n, "n", { min: 0n, max: MAX_N });
    const k = readInt(v.k, "k", { min: 0n, max: MAX_N });
    if (k > n) throw new CalcError(`k can't be more than n: there's no way to pick ${k} from ${n}.`);
    if (v.kind === "p") {
      const steps: Step[] = [
        {
          title: "Fill the places in order",
          lines: [
            k === 0n
              ? `There is exactly one way to arrange nothing.`
              : `The first of the ${k} places has ${n} options, the next one fewer, and so on:`,
            m(`P(${n},\\text{ }${k}) = ${fallingFactors(n, k)}`),
          ],
        },
      ];
      const lines: string[] = [];
      let p = 1n;
      for (let i = 0n; i < k; i++) {
        const next = p * (n - i);
        lines.push(m(`${fmtInt(p)} \\cdot ${fmtInt(n - i)} = ${fmtInt(next)}`));
        p = next;
      }
      if (lines.length) steps.push({ title: "Multiply", lines: lines.length <= 12 ? lines : [...lines.slice(0, 5), `… (${lines.length - 7} more) …`, ...lines.slice(-2)] });
      return { steps, answer: m(`P(${n},\\text{ }${k}) = ${fmtInt(p)}`) };
    }
    const { steps, value } = chooseSteps(n, k);
    return { steps, answer: m(`\\binom{${n}}{${k}} = ${fmtInt(value)}`) };
  },
};

// ---- arrangements with repeats ----------------------------------------------------------

const arrangeTool: Tool = {
  id: "arrange",
  domain: "Counting",
  name: "Arrangements with repeats",
  blurb: "Orderings of a word with repeated letters (or of objects in groups of identical ones).",
  fields: [
    {
      key: "items",
      label: "Word, or group sizes",
      placeholder: "e.g. BANANA or 3, 2, 1",
      hint: "A word counts its letters. A list like 3, 2, 1 means 3 identical items of one kind, 2 of another, 1 of a third.",
    },
  ],
  example: { items: "MISSISSIPPI" },
  run(v): CalcResult {
    const raw = (v.items ?? "").trim();
    if (!raw) throw new CalcError("Enter a word or a list of group sizes.");
    let groups: [string, bigint][];
    const steps: Step[] = [];
    if (/^[\d,\s]+$/.test(raw)) {
      const sizes = raw.split(/[,\s]+/).filter(Boolean).map((s) => readInt(s, "each group size", { min: 1n, max: 200n }));
      groups = sizes.map((s, k) => [`group ${k + 1}`, s]);
    } else {
      const letters = raw.toUpperCase().replace(/\s+/g, "");
      if (!/^[A-Z]+$/.test(letters)) throw new CalcError("Use only letters for a word, or only numbers and commas for group sizes.");
      const counts = new Map<string, bigint>();
      for (const c of letters) counts.set(c, (counts.get(c) ?? 0n) + 1n);
      groups = [...counts.entries()].sort((a, b) => (b[1] > a[1] ? 1 : b[1] < a[1] ? -1 : a[0].localeCompare(b[0])));
      steps.push({ title: "Count each letter", lines: [groups.map(([c, n]) => `${c}: ${n}`).join(", ")] });
    }
    const n = groups.reduce((a, [, c]) => a + c, 0n);
    if (n > 200n) throw new CalcError("That's more than 200 items; try fewer.");
    const reps = groups.filter(([, c]) => c > 1n);
    const den = reps.map(([, c]) => `${c}!`).join(" \\cdot ") || "1";
    steps.push({
      title: "Write the formula",
      lines: [
        `If every item were different there would be ${n}! orders. Swapping identical items gives the same arrangement, so divide by the factorial of each group size.`,
        m(reps.length ? `\\frac{${n}!}{${den}}` : `${n}!`),
      ],
    });
    const top = factorial(n);
    const bottom = reps.reduce((a, [, c]) => a * factorial(c), 1n);
    const value = top / bottom;
    const lines = [m(`${n}! = ${fmtInt(top)}`)];
    if (reps.length) {
      lines.push(m(`${den} = ${reps.map(([, c]) => fmtInt(factorial(c))).join(" \\cdot ")} = ${fmtInt(bottom)}`));
      lines.push(m(`\\frac{${fmtInt(top)}}{${fmtInt(bottom)}} = ${fmtInt(value)}`));
    }
    steps.push({ title: "Compute", lines });
    if (reps.length && groups.length >= 2) {
      // Same count as choosing places for each group in turn.
      let left = n;
      const parts: string[] = [];
      for (const [, c] of groups.slice(0, -1)) {
        parts.push(`\\binom{${left}}{${c}}`);
        left -= c;
      }
      steps.push({ title: "Check another way", lines: [`Choose the places for each group in turn: ${m(`${parts.join(" \\cdot ")} = ${fmtInt(value)}`)}.`] });
    }
    return { steps, answer: `${fmtInt(value)} arrangements` };
  },
};

// ---- stars and bars ---------------------------------------------------------------------

const starsTool: Tool = {
  id: "stars",
  domain: "Counting",
  name: "Distribute identical items",
  blurb: "Ways to split n identical items among k people or boxes (stars and bars).",
  fields: [
    { key: "rule", label: "Rule", kind: "select", options: [["0", "A box may be empty (each ≥ 0)"], ["1", "Every box gets at least one (each ≥ 1)"]] },
    { key: "n", label: "n (identical items)", placeholder: "e.g. 10" },
    { key: "k", label: "k (boxes)", placeholder: "e.g. 4" },
  ],
  example: { rule: "1", n: "10", k: "4" },
  run(v): CalcResult {
    const n = readInt(v.n, "n", { min: 0n, max: MAX_N });
    const k = readInt(v.k, "k", { min: 1n, max: 200n });
    const steps: Step[] = [];
    let free = n;
    if (v.rule === "1") {
      if (n < k) {
        steps.push({ title: "Not enough items", lines: [`Giving each of ${k} boxes one item needs ${k} items, but there are only ${n}.`] });
        return { steps, answer: "0 ways" };
      }
      free = n - k;
      steps.push({ title: "Give each box one first", lines: [`That uses ${k} items and leaves ${m(`${n} - ${k} = ${free}`)} to share with no restriction.`] });
    }
    steps.push({
      title: "Stars and bars",
      lines: [
        `Line up the ${free} items as stars and add ${k - 1n} bars to split them into ${k} boxes. Each arrangement of ${free} stars and ${k - 1n} bars is one distribution, so choose which of the ${free + k - 1n} spots hold bars:`,
        m(`\\binom{${free} + ${k} - 1}{${k} - 1} = \\binom{${free + k - 1n}}{${k - 1n}}`),
      ],
    });
    const { steps: cs, value } = chooseSteps(free + k - 1n, k - 1n);
    steps.push(...cs);
    return { steps, answer: `${fmtInt(value)} ways` };
  },
};

export const COUNTING_TOOLS: Tool[] = [chooseTool, arrangeTool, starsTool];

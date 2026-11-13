// Math scroll: endless little multiple-choice problems (pure, seeded, no database).
// Every problem carries the inputs it was built from (`params`) so tests can re-solve it independently.

export type Level = 1 | 2 | 3;
export type Kind =
  | "mult" | "percent" | "successive" | "linear" | "exp" | "remainder" | "units"
  | "handshake" | "sumTo" | "oddsum" | "mean" | "square" | "pythag" | "divisors" | "arrange" | "nth";

export interface ScrollProblem {
  id: string;
  kind: Kind;
  level: Level;
  prompt: string;
  choices: string[]; // 4 distinct numbers as text
  answerIndex: number;
  explanation: string;
  params: Record<string, number>;
  answer: number;
}

type Rand = () => number;

/** Small deterministic PRNG (mulberry32). */
export function makeRng(seed: number): Rand {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const int = (r: Rand, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
const pick = <T,>(r: Rand, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
const fact = (n: number): number => (n <= 1 ? 1 : n * fact(n - 1));

interface Draft {
  kind: Kind;
  prompt: string;
  answer: number;
  explanation: string;
  params: Record<string, number>;
  traps?: number[]; // plausible wrong answers from common mistakes
}

const GEN: Record<Kind, (r: Rand, l: Level) => Draft> = {
  mult(r, l) {
    const [a, b] = l === 1 ? [int(r, 12, 99), int(r, 3, 9)] : l === 2 ? [int(r, 13, 29), int(r, 13, 29)] : [int(r, 31, 99), int(r, 11, 25)];
    return {
      kind: "mult", params: { a, b }, answer: a * b,
      prompt: `${a} × ${b} = ?`,
      explanation: `Split ${b} into tens and ones: ${a}×${Math.floor(b / 10) * 10} + ${a}×${b % 10} = ${a * b}.`,
      traps: [a * b + 10, a * b - 10],
    };
  },
  percent(r, l) {
    const p = l === 1 ? pick(r, [10, 25, 50]) : pick(r, [5, 15, 20, 30, 35, 40, 60, 75]);
    const y = (100 / gcd(p, 100)) * int(r, l === 1 ? 1 : 2, l === 1 ? 8 : 12);
    return {
      kind: "percent", params: { p, y }, answer: (p * y) / 100,
      prompt: `What is ${p}% of ${y}?`,
      explanation: `${p}% of ${y} = ${p}/100 × ${y} = ${(p * y) / 100}.`,
      traps: [y - (p * y) / 100, (p * y) / 10],
    };
  },
  successive(r) {
    const up = pick(r, [10, 20, 25, 50]);
    const down = pick(r, [10, 20, 25, 50]);
    const y = 400 * int(r, 1, 3);
    return {
      kind: "successive", params: { y, up, down }, answer: (y * (100 + up) * (100 - down)) / 10000,
      prompt: `A price of $${y} goes up ${up}%, then the new price goes down ${down}%. What is the final price?`,
      explanation: `Multiply: ${y} × ${(100 + up) / 100} × ${(100 - down) / 100} = ${(y * (100 + up) * (100 - down)) / 10000}. The changes don't cancel.`,
      traps: [y + (y * (up - down)) / 100],
    };
  },
  linear(r, l) {
    const a = l === 1 ? int(r, 2, 5) : int(r, 3, 12);
    const x = int(r, 2, l === 1 ? 12 : 20);
    const b = int(r, 1, l === 3 ? 40 : 15) * (l === 1 || r() < 0.5 ? 1 : -1);
    const c = a * x + b;
    return {
      kind: "linear", params: { a, b, x, c }, answer: x,
      prompt: `${a}x ${b < 0 ? "−" : "+"} ${Math.abs(b)} = ${c}. What is x?`,
      explanation: `Move the constant: ${a}x = ${c - b}. Then x = ${c - b}/${a} = ${x}.`,
      traps: [c - b, x + 1],
    };
  },
  exp(r, l) {
    const base = l === 3 ? 3 : 2;
    const c = int(r, 1, 4);
    const a = int(r, 2, l === 3 ? 4 : 6);
    const b = int(r, c + 1 - a > 0 ? c + 1 - a : 1, l === 3 ? 4 : 6);
    const n = a + b - c;
    return {
      kind: "exp", params: { base, a, b, c, n }, answer: base ** n,
      prompt: `${base}^${a} × ${base}^${b} ÷ ${base}^${c} = ?`,
      explanation: `Add exponents when multiplying, subtract when dividing: ${base}^(${a}+${b}−${c}) = ${base}^${n} = ${base ** n}.`,
      traps: [base ** (a + b), base ** (a * b - c)],
    };
  },
  remainder(r) {
    const N = int(r, 10000, 999999);
    const rem = String(N).split("").reduce((s, d) => s + Number(d), 0) % 9;
    return {
      kind: "remainder", params: { N }, answer: rem,
      prompt: `What is the remainder when ${N} is divided by 9?`,
      explanation: `A number leaves the same remainder as its digit sum mod 9. Digit sum ≡ ${rem} (mod 9).`,
      traps: [N % 10, (rem + 1) % 9],
    };
  },
  units(r) {
    const base = pick(r, [2, 3, 7, 8, 9]);
    const n = int(r, 12, 99);
    let u = 1;
    for (let i = 0; i < n; i++) u = (u * base) % 10;
    return {
      kind: "units", params: { base, n }, answer: u,
      prompt: `What is the units digit of ${base}^${n}?`,
      explanation: `Units digits of powers of ${base} repeat in a cycle. Reduce ${n} by the cycle length to get ${u}.`,
      traps: [base, (u + 2) % 10],
    };
  },
  handshake(r, l) {
    const n = l === 1 ? int(r, 4, 8) : int(r, 9, 20);
    return {
      kind: "handshake", params: { n }, answer: (n * (n - 1)) / 2,
      prompt: `${n} people each shake hands with every other person exactly once. How many handshakes?`,
      explanation: `Each of ${n} people shakes ${n - 1} hands, but each handshake is counted twice: ${n}×${n - 1}/2 = ${(n * (n - 1)) / 2}.`,
      traps: [n * (n - 1), n * n],
    };
  },
  sumTo(r, l) {
    const n = l === 1 ? int(r, 5, 12) : int(r, 15, 60);
    return {
      kind: "sumTo", params: { n }, answer: (n * (n + 1)) / 2,
      prompt: `What is 1 + 2 + 3 + … + ${n}?`,
      explanation: `Pair first and last: the sum is n(n+1)/2 = ${n}×${n + 1}/2 = ${(n * (n + 1)) / 2}.`,
      traps: [n * (n + 1), (n * (n - 1)) / 2],
    };
  },
  oddsum(r) {
    const n = int(r, 8, 40);
    return {
      kind: "oddsum", params: { n }, answer: n * n,
      prompt: `What is the sum of the first ${n} odd numbers (1 + 3 + 5 + …)?`,
      explanation: `The sum of the first n odd numbers is n². Here ${n}² = ${n * n}.`,
      traps: [n * (n + 1), n * n - n],
    };
  },
  mean(r, l) {
    const xs = Array.from({ length: 4 }, () => int(r, l === 1 ? 5 : 10, l === 1 ? 30 : 95));
    let e = int(r, l === 1 ? 5 : 10, l === 1 ? 30 : 95);
    while ((xs.reduce((s, v) => s + v, 0) + e) % 5 !== 0) e++;
    const m = (xs.reduce((s, v) => s + v, 0) + e) / 5;
    return {
      kind: "mean", params: { a: xs[0], b: xs[1], c: xs[2], d: xs[3], m, e }, answer: e,
      prompt: `The mean of five numbers is ${m}. Four of them are ${xs.join(", ")}. What is the fifth?`,
      explanation: `Total = 5×${m} = ${5 * m}. Fifth = ${5 * m} − ${xs.reduce((s, v) => s + v, 0)} = ${e}.`,
      traps: [m, 5 * m],
    };
  },
  square(r, l) {
    const s = int(r, 3, l === 1 ? 12 : 25);
    return {
      kind: "square", params: { P: 4 * s }, answer: s * s,
      prompt: `A square has perimeter ${4 * s}. What is its area?`,
      explanation: `Side = ${4 * s}/4 = ${s}, so area = ${s}² = ${s * s}.`,
      traps: [4 * s, 2 * s * s],
    };
  },
  pythag(r) {
    const [x, y, z] = pick(r, [[3, 4, 5], [5, 12, 13], [8, 15, 17]] as const);
    const k = int(r, 2, 9);
    return {
      kind: "pythag", params: { x: x * k, y: y * k, z: z * k }, answer: z * k,
      prompt: `A right triangle has legs ${x * k} and ${y * k}. How long is the hypotenuse?`,
      explanation: `It's a ${x}-${y}-${z} triangle scaled by ${k}, so the hypotenuse is ${z * k}.`,
      traps: [x * k + y * k, z * k + k],
    };
  },
  divisors(r, l) {
    const [p, q] = pick(r, [[2, 3], [2, 5], [3, 5], [2, 7]] as const);
    const a = int(r, 1, l === 2 ? 4 : 6);
    const b = int(r, 1, l === 2 ? 3 : 5);
    return {
      kind: "divisors", params: { p, a, q, b }, answer: (a + 1) * (b + 1),
      prompt: `How many positive divisors does ${p ** a * q ** b} have?`,
      explanation: `${p ** a * q ** b} = ${p}^${a} × ${q}^${b}. Add 1 to each exponent and multiply: ${a + 1}×${b + 1} = ${(a + 1) * (b + 1)}.`,
      traps: [a * b, a + b + 2],
    };
  },
  arrange(r, l) {
    const n = int(r, 3, l === 1 ? 5 : l === 2 ? 6 : 7);
    return {
      kind: "arrange", params: { n }, answer: fact(n),
      prompt: `In how many different orders can ${n} different books be lined up on a shelf?`,
      explanation: `${n} choices, then ${n - 1}, … down to 1: ${n}! = ${fact(n)}.`,
      traps: [n * n, fact(n) / n],
    };
  },
  nth(r, l) {
    const a = int(r, 1, 20);
    const d = int(r, 2, l === 1 ? 7 : 15);
    const n = int(r, 10, l === 1 ? 25 : 80);
    return {
      kind: "nth", params: { a, d, n }, answer: a + (n - 1) * d,
      prompt: `The sequence ${a}, ${a + d}, ${a + 2 * d}, … adds ${d} each time. What is term number ${n}?`,
      explanation: `Term n is first + (n−1)×step = ${a} + ${n - 1}×${d} = ${a + (n - 1) * d}.`,
      traps: [a + n * d, a + (n - 1) * d + d],
    };
  },
};

const POOL: Record<Level, Kind[]> = {
  1: ["mult", "percent", "linear", "handshake", "sumTo", "mean", "square", "arrange", "nth"],
  2: ["mult", "percent", "linear", "exp", "remainder", "units", "handshake", "sumTo", "oddsum", "mean", "square", "divisors", "arrange", "nth"],
  3: ["mult", "successive", "linear", "exp", "units", "handshake", "sumTo", "oddsum", "mean", "pythag", "divisors", "arrange", "nth"],
};

function shuffle<T>(r: Rand, xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildChoices(r: Rand, answer: number, traps: number[]): { choices: number[]; answerIndex: number } {
  const set = new Set<number>([answer]);
  for (const t of traps) if (Number.isInteger(t) && t >= 0 && set.size < 4) set.add(t);
  const spread = Math.max(1, Math.round(Math.abs(answer) * 0.1));
  for (let k = 1; set.size < 4; k++) {
    for (const cand of [answer + k * spread, answer - k * spread]) {
      if (cand >= 0 && set.size < 4) set.add(cand);
    }
  }
  const choices = shuffle(r, [...set]);
  return { choices, answerIndex: choices.indexOf(answer) };
}

/** Deterministic problem for a seed and level. */
export function generateProblem(seed: number, level: Level): ScrollProblem {
  const r = makeRng(seed);
  const kind = pick(r, POOL[level]);
  const d = GEN[kind](r, level);
  const { choices, answerIndex } = buildChoices(r, d.answer, d.traps ?? []);
  return {
    id: `${seed}-${level}`,
    kind: d.kind,
    level,
    prompt: d.prompt,
    choices: choices.map(String),
    answerIndex,
    explanation: d.explanation,
    params: d.params,
    answer: d.answer,
  };
}

/** Move up after 3 correct in a row, down after 2 misses in a row. */
export function nextLevel(level: Level, recent: boolean[]): Level {
  const last3 = recent.slice(-3);
  if (last3.length === 3 && last3.every(Boolean) && level < 3) return (level + 1) as Level;
  const last2 = recent.slice(-2);
  if (last2.length === 2 && last2.every((x) => !x) && level > 1) return (level - 1) as Level;
  return level;
}

/** Minutes of credit for scroll time (counts toward the 10-minute streak minimum). Capped per day. */
export const SCROLL_MAX_SECONDS_PER_PROBLEM = 90;
export const SCROLL_MAX_MINUTES_PER_DAY = 30;

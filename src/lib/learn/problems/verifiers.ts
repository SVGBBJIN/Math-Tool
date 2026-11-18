// Independent answer keys for the Daily Problem bank. Each entry works every computable
// step out again from the problem's statement (or its generated parameters) by brute force,
// enumeration or coordinates, and never reads a stored answer. A `null` marks a step with
// no computable key (a "which idea fits" choice). The final entry is the final answer.
// Validation (./validate.ts) compares these with the stored keys and fails the build on any
// difference.

type Keys = (number | null)[];
type P = Record<string, number>;

const range = (lo: number, hi: number) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
const find = (lo: number, hi: number, test: (n: number) => boolean) => range(lo, hi).find(test)!;
const count = (lo: number, hi: number, test: (n: number) => boolean) => range(lo, hi).filter(test).length;
const g = (a: number, b: number): number => (b ? g(b, a % b) : a);
const pairs = (n: number) => range(0, n - 1).flatMap((i) => range(i + 1, n - 1).map((j) => [i, j] as const));
type Pt = [number, number];
const dist = (p: Pt, q: Pt) => Math.hypot(p[0] - q[0], p[1] - q[1]);
const shoelace = (pts: Pt[]) => Math.abs(pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
const lerp = (p: Pt, q: Pt, t: number): Pt => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
/** Distance from point p to the line through a and b. */
const toLine = (p: Pt, a: Pt, b: Pt) => Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / dist(a, b);

export const PROBLEM_VERIFIERS: Record<string, (p: P) => Keys> = {
  "p.alg.tickets": () => {
    const adults = find(0, 140, (a) => 9 * a + 5 * (140 - a) === 940);
    const guess = range(1, 140).reduce((s) => s + 5, 0);
    return [guess, 9 - 5, 940 - guess, adults];
  },
  "p.alg.work": () => {
    // Ava's hours t: 1/t + 1/6 = 1/4, i.e. 4(t + 6) = 6t. Found by search, not by algebra.
    const t = find(1, 1000, (h) => 4 * (h + 6) === 6 * h);
    return [1 / 4, 1 / 6, 1 / t, t];
  },
  "p.alg.squares": () => {
    const x = find(0, 30, (v) => v * v + (30 - v) * (30 - v) === 468);
    const y = 30 - x;
    return [null, (x + y) ** 2, 2 * x * y, x * y];
  },
  "p.alg.vieta": ({ s, p }) => {
    const root = Math.sqrt(s * s - 4 * p);
    const [r, t] = [(s + root) / 2, (s - root) / 2];
    return [null, r + t, r * t, 2 * r * t, r * r + t * t];
  },
  "p.alg.arith": ({ a1, d, m, n, k }) => {
    const term = (a: number, step: number, i: number) => a + (i - 1) * step;
    const [Tm, Tn] = [term(a1, d, m), term(a1, d, n)];
    // Recover the sequence from the two given terms alone, by search.
    let found: [number, number] | null = null;
    for (let a = -300; a <= 300 && !found; a++) for (let dd = -40; dd <= 40; dd++) if (term(a, dd, m) === Tm && term(a, dd, n) === Tn) { found = [a, dd]; break; }
    const [a, dd] = found!;
    return [count(m + 1, n, () => true), dd, count(n + 1, k, () => true), term(a, dd, k)];
  },

  "p.nt.remainder": () => {
    const lcm = find(1, 10_000, (v) => [3, 4, 5, 6].every((q) => v % q === 0));
    const N = find(1, 100_000, (v) => [3, 4, 5, 6].every((q) => v % q === 2) && v % 7 === 0);
    return [lcm, (N - 2) / lcm, N];
  },
  "p.nt.gcdlcm": () => {
    let best = Infinity;
    for (let a = 1; a <= 180; a++) for (let b = a + 1; b <= 180; b++) if (g(a, b) === 6 && (a * b) / g(a, b) === 180) best = Math.min(best, a + b);
    const xy = 180 / 6;
    const coprimePairs = range(1, xy).filter((x) => xy % x === 0 && x < xy / x && g(x, xy / x) === 1);
    return [xy, coprimePairs.length, Math.min(...coprimePairs.map((x) => x + xy / x)), best];
  },
  "p.nt.evendiv": ({ a, b, c }) => {
    const N = 2 ** a * 3 ** b * 5 ** c;
    let twos = 0;
    for (let v = N; v % 2 === 0; v /= 2) twos++;
    const odd = N / 2 ** twos;
    return [twos, count(1, twos, (i) => N % 2 ** i === 0), count(1, odd, (d) => odd % d === 0), count(1, N, (d) => N % d === 0 && d % 2 === 0)];
  },
  "p.nt.units": ({ base, e }) => {
    const unit = (k: number) => range(1, k).reduce((acc) => (acc * base) % 10, 1);
    const cycle = find(1, 20, (L) => unit(1 + L) === unit(1) && unit(2 + L) === unit(2));
    return [cycle, e % 4, unit(e)];
  },

  "p.cp.dice": () => {
    const rolls = range(1, 6).flatMap((x) => range(1, 6).flatMap((y) => range(1, 6).map((z) => [x, y, z])));
    const none = rolls.filter((r) => !r.includes(6)).length;
    return [null, rolls.length, none, (rolls.length - none) / rolls.length];
  },
  "p.cp.banana": () => {
    const all = new Set<string>();
    const go = (left: string, built: string) => { if (!left) { all.add(built); return; } for (let i = 0; i < left.length; i++) go(left.slice(0, i) + left.slice(i + 1), built + left[i]); };
    go("BANANA", "");
    const others = new Set<string>();
    const go2 = (left: string, built: string) => { if (!left) { others.add(built); return; } for (let i = 0; i < left.length; i++) go2(left.slice(0, i) + left.slice(i + 1), built + left[i]); };
    go2("BAAA", "");
    return [others.size, 4 + 1, pairs(5).length, [...all].filter((w) => !w.includes("NN")).length];
  },
  "p.cp.digitsum": ({ s }) => {
    const sum = (v: number) => String(v).split("").reduce((t, ch) => t + Number(ch), 0);
    return [s - 1, s - 1 + 2, count(100, 999, (v) => sum(v) === s)];
  },
  "p.cp.orboth": ({ p, q, N }) => {
    const by = (d: number) => count(1, N, (v) => v % d === 0);
    return [by(p), by(q), count(1, N, (v) => v % p === 0 && v % q === 0), count(1, N, (v) => (v % p === 0) !== (v % q === 0))];
  },
  "p.cp.marbles": ({ red, blue }) => {
    const bag = [...Array(red).fill("r"), ...Array(blue).fill("b")] as string[];
    const all = pairs(bag.length);
    const rr = all.filter(([i, j]) => bag[i] === "r" && bag[j] === "r").length;
    const bb = all.filter(([i, j]) => bag[i] === "b" && bag[j] === "b").length;
    return [all.length, rr, bb, (rr + bb) / all.length];
  },

  "p.geo.boxarea": () => {
    const quad: Pt[] = [[0, 0], [6, 0], [8, 5], [1, 7]];
    const xs = quad.map((p) => p[0]), ys = quad.map((p) => p[1]);
    const box = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
    return [box, box - shoelace(quad), shoelace(quad)];
  },
  "p.geo.polygon": () => {
    const n = find(3, 1000, (k) => (k - 2) * 180 === 156 * k);
    const nonAdjacent = (i: number, j: number) => (j - i) % n !== 1 && (i - j + n) % n !== 1;
    return [180 - 156, n, count(1, n - 1, (j) => nonAdjacent(0, j)), pairs(n).filter(([i, j]) => nonAdjacent(i, j)).length];
  },
  "p.geo.similar": () => {
    // B and C on the x-axis with BC = 15, A placed so that AB = 10.
    const [B, C, A]: Pt[] = [[0, 0], [15, 0], [6, 8]];
    const D = lerp(A, B, 4 / dist(A, B));
    const E = lerp(A, C, 4 / dist(A, B));
    const [small, big] = [shoelace([A, D, E]), shoelace([A, B, C])];
    return [dist(A, D) / dist(A, B), dist(D, E), small / big, small / (big - small)];
  },
  "p.geo.altitude": ({ a, b }) => {
    const [C, B, A]: Pt[] = [[0, 0], [b, 0], [0, a]];
    return [dist(A, B), shoelace([A, B, C]), dist(A, B) * toLine(C, A, B), toLine(C, A, B)];
  },
  "p.geo.inradius": ({ a, b }) => {
    const [C, B, A]: Pt[] = [[0, 0], [b, 0], [0, a]];
    const [la, lb, lc] = [dist(B, C), dist(C, A), dist(A, B)];
    // Incentre as the side-weighted average of the vertices; radius as its distance to AB.
    const I: Pt = [(la * A[0] + lb * B[0] + lc * C[0]) / (la + lb + lc), (la * A[1] + lb * B[1] + lc * C[1]) / (la + lb + lc)];
    return [lc, shoelace([A, B, C]), (la + lb + lc) / 2, toLine(I, A, B)];
  },
};

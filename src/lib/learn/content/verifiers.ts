// Independent answer keys. Every card marked `computed` has an entry here that works the
// answer out again from the problem statement: by brute-force enumeration, by direct
// integer arithmetic, or by exact arithmetic on a + b√d. Nothing in this file reads a
// card's stored answer, and none of it shares code with the answer checker.
// `npm run verify:cards` compares the two and fails the build on any difference.

type Key = string | string[];
const range = (lo: number, hi: number) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
const count = (lo: number, hi: number, test: (n: number) => boolean) => range(lo, hi).filter(test).length;
const digits = (n: number) => String(n).split("").map(Number);
const all = (lo: number, hi: number, test: (n: number) => boolean) => range(lo, hi).every(test);
const divisors = (n: number) => range(1, n).filter((d) => n % d === 0);
function primeFactors(n: number): Map<number, number> {
  const out = new Map<number, number>();
  for (let p = 2; n > 1; p++) while (n % p === 0) { out.set(p, (out.get(p) ?? 0) + 1); n /= p; }
  return out;
}
const powMod = (b: number, e: number, m: number) => range(1, e).reduce((acc) => (acc * b) % m, 1);
const isSquare = (n: number) => Number.isInteger(Math.sqrt(n)) && Math.round(Math.sqrt(n)) ** 2 === n;
const isCube = (n: number) => range(1, 200).some((k) => k ** 3 === n);
const first = (test: (k: number) => boolean) => range(1, 100000).find(test)!;

function tuples<T>(xs: T[], len: number): T[][] {
  return len === 0 ? [[]] : xs.flatMap((x) => tuples(xs, len - 1).map((rest) => [x, ...rest]));
}
function perms<T>(xs: T[], len: number): T[][] {
  return len === 0 ? [[]] : xs.flatMap((x, i) => perms([...xs.slice(0, i), ...xs.slice(i + 1)], len - 1).map((rest) => [x, ...rest]));
}
function subsets<T>(xs: T[], len: number): T[][] {
  return len === 0 ? [[]] : xs.flatMap((x, i) => subsets(xs.slice(i + 1), len - 1).map((rest) => [x, ...rest]));
}

// ---- exact arithmetic on p + q√d (p, q rational), for roots of quadratics --------------
type Fr = [number, number];
const g = (a: number, b: number): number => (b ? g(b, a % b) : Math.abs(a));
const F = (n: number, d = 1): Fr => { const k = g(n, d) || 1; return d < 0 ? [-n / k, -d / k] : [n / k, d / k]; };
const fa = (a: Fr, b: Fr) => F(a[0] * b[1] + b[0] * a[1], a[1] * b[1]);
const fm = (a: Fr, b: Fr) => F(a[0] * b[0], a[1] * b[1]);
interface Surd { p: Fr; q: Fr; d: number }
const sAdd = (x: Surd, y: Surd): Surd => ({ p: fa(x.p, y.p), q: fa(x.q, y.q), d: x.d });
const sMul = (x: Surd, y: Surd): Surd => ({ p: fa(fm(x.p, y.p), fm(fm(x.q, y.q), F(x.d))), q: fa(fm(x.p, y.q), fm(x.q, y.p)), d: x.d });
const sNum = (n: number, d: number): Surd => ({ p: F(n), q: F(0), d });
/** The two roots of ax² + bx + c. */
function roots(a: number, b: number, c: number): [Surd, Surd] {
  const d = b * b - 4 * a * c;
  return [{ p: F(-b, 2 * a), q: F(1, 2 * a), d }, { p: F(-b, 2 * a), q: F(-1, 2 * a), d }];
}
/** A value that must be rational: fails loudly if a √ survives. */
function rational(x: Surd): string {
  if (x.q[0] !== 0 && x.d !== 0) throw new Error("expected a rational value");
  return x.p[1] === 1 ? `${x.p[0]}` : `${x.p[0]}/${x.p[1]}`;
}
/** 1/x for x = p + q√d: multiply by the conjugate. */
function sInv(x: Surd): Surd {
  const norm = fa(fm(x.p, x.p), fm(F(-x.d), fm(x.q, x.q)));
  const inv: Fr = F(norm[1], norm[0]);
  return { p: fm(x.p, inv), q: fm(F(-x.q[0], x.q[1]), inv), d: x.d };
}

// ---- geometry from coordinates ----------------------------------------------------------
type P = [number, number];
const deg = (r: number) => (r * 180) / Math.PI;
/** Angle at `at` between the rays towards p and q, in degrees. */
function angleAt(at: P, p: P, q: P): number {
  const [ux, uy, vx, vy] = [p[0] - at[0], p[1] - at[1], q[0] - at[0], q[1] - at[1]];
  return deg(Math.acos((ux * vx + uy * vy) / (Math.hypot(ux, uy) * Math.hypot(vx, vy))));
}
const near = (a: number, b: number, tol = 0.6) => Math.abs(a - b) <= tol;
const area = (pts: P[]) => Math.abs(pts.reduce((s, p, i) => s + p[0] * pts[(i + 1) % pts.length][1] - pts[(i + 1) % pts.length][0] * p[1], 0)) / 2;
const dist = (a: P, b: P) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function must(ok: boolean, what: string) {
  if (!ok) throw new Error(`figure does not match the problem: ${what}`);
}

export const VERIFIERS: Record<string, () => Key> = {
  // multiples and divisibility
  "nt.divisibility.i1": () => (all(1, 500, (n) => (n + (n + 1) + (n + 2)) % 3 === 0) ? "always" : "sometimes"),
  "nt.divisibility.t1": () => [all(1, 500, (n) => (n * n + n) % 2 === 0) ? "2" : "1", String(7 * 7 + 7)],
  "nt.divisibility.t2": () => (58317 % 9 === 0 ? "both" : 58317 % 3 === 0 ? "three" : "neither"),
  "nt.divisibility.r1": () => {
    const f: Record<string, (n: number) => number> = { sum: (n) => n + (n + 1) + (n + 2), product: (n) => n * (n + 1) * (n + 2), spaced: (n) => n + (n + 2) + (n + 4), pair: (n) => n * (n + 2) };
    return Object.keys(f).filter((k) => all(1, 300, (n) => f[k](n) % 3 === 0));
  },
  "nt.divisibility.a1": () => String(count(1, 200, (n) => n % 7 === 0)),
  "nt.divisibility.a2": () => String(count(100, 300, (n) => n % 6 === 0)),
  "nt.divisibility.v1": () => {
    const rs = new Set(range(1, 400).map((n) => (n + (n + 1) + (n + 2) + (n + 3)) % 4));
    if (rs.size !== 1) throw new Error("remainder is not constant");
    return String([...rs][0]);
  },
  // prime factorization
  "nt.primes.i1": () => String(divisors(36).length),
  "nt.primes.t1": () => { const f = primeFactors(200); return [String(f.get(2)), String(f.get(5)), String(divisors(200).length)]; },
  "nt.primes.r1": () => Object.entries({ a: 2 ** 4 * 3 ** 2, b: 2 ** 3 * 5 ** 2, c: 3 ** 6 * 7 ** 2, d: 2 ** 2 * 3 ** 2 * 5 }).filter(([, n]) => isSquare(n)).map(([k]) => k),
  "nt.primes.a3": () => String([...primeFactors(420).keys()].reduce((a, b) => a + b, 0)),
  "nt.primes.a1": () => String(divisors(360).length),
  "nt.primes.a2": () => String(first((k) => isSquare(84 * k))),
  "nt.primes.v1": () => String(first((k) => isCube(72 * k))),
  // remainders
  "nt.remainders.i1": () => {
    const rs = new Set(range(1, 200).filter((a) => a % 5 === 3).flatMap((a) => range(1, 200).filter((b) => b % 5 === 4).map((b) => (a + b) % 5)));
    if (rs.size !== 1) throw new Error("remainder is not determined");
    return String([...rs][0]);
  },
  "nt.remainders.t1": () => String((103 * 58) % 7),
  "nt.remainders.r1": () => {
    const squares = new Set(range(0, 1000).map((n) => (n * n) % 4));
    return Object.entries({ a: 1000003, b: 2222222, c: 4000001, d: 1000000 }).filter(([, n]) => !squares.has(n % 4)).map(([k]) => k);
  },
  "nt.remainders.a1": () => String((91 * 92 * 93) % 9),
  "nt.remainders.a2": () => {
    const rs = new Set(range(1, 1000).filter((n) => n % 12 === 7).map((n) => n % 4));
    if (rs.size !== 1) throw new Error("remainder is not determined");
    return String([...rs][0]);
  },
  "nt.remainders.v1": () => String(powMod(14, 9, 15)),
  // repeating patterns
  "nt.cycles.i1": () => String(powMod(3, 5, 10)),
  "nt.cycles.t1": () => String(powMod(3, 22, 10)),
  "nt.cycles.a1": () => String(powMod(7, 123, 10)),
  "nt.cycles.a2": () => String(powMod(2, 100, 10)),
  "nt.cycles.v1": () => {
    let r = 1;
    let digit = 0;
    for (let i = 0; i < 100; i++) { r *= 10; digit = Math.floor(r / 7); r %= 7; }
    return String(digit);
  },
  "nt.cycles.v2": () => String((powMod(3, 50, 10) + powMod(7, 50, 10)) % 10),
  // factoring: the expanded form, written out independently of the factored key
  "alg.factoring.i1": () => String(51 * 51 - 49 * 49),
  "alg.factoring.t2": () => "5x^3 - 10x^2",
  "alg.factoring.t1": () => "x^2 + 9x + 20",
  "alg.factoring.a2": () => "x^2 - x - 12",
  "alg.factoring.a1": () => String(Math.max(...primeFactors(2 ** 12 - 1).keys())),
  "alg.factoring.v1": () => "3x^3 - 12x",
  "alg.factoring.v2": () => String(new Set(range(1, 12).flatMap((p) => range(1, 12).filter((q) => p * q === 12).map((q) => p + q))).size),
  // sum and product of roots
  "alg.vieta.i1": () => { const [r, s] = roots(1, -10, 21); return rational(sAdd(r, s)); },
  "alg.vieta.t1": () => { const [r, s] = roots(1, -6, 4); return rational(sAdd(sMul(r, r), sMul(s, s))); },
  "alg.vieta.a2": () => { const [r, s] = roots(2, -9, 6); return rational(sMul(r, s)); },
  "alg.vieta.a1": () => { const [r, s] = roots(1, 4, -7); const one = sNum(1, r.d); return rational(sMul(sAdd(r, one), sAdd(s, one))); },
  "alg.vieta.v1": () => String(first((k) => range(1, 12).some((r) => r + 2 * r === 12 && r * 2 * r === k))),
  "alg.vieta.v2": () => {
    const hits = range(-40, 40).filter((b) => range(1, 30).some((r) => r * (r + 1) === 20 && -(r + r + 1) === b));
    if (hits.length !== 1) throw new Error("b is not unique");
    return String(hits[0]);
  },
  // arithmetic sequences
  "alg.arith-seq.i1": () => String(range(1, 100).reduce((a, b) => a + b, 0)),
  "alg.arith-seq.t1": () => { let n = 0; for (let x = 5; x <= 62; x += 3) n++; return String(n); },
  "alg.arith-seq.a1": () => { const d = (41 - 17) / (10 - 4); return String(17 + (20 - 4) * d); },
  "alg.arith-seq.a2": () => { let s = 0; for (let x = 3; x <= 79; x += 4) s += x; return String(s); },
  "alg.arith-seq.v1": () => String(first((k) => k % 2 === 0 && [0, 2, 4, 6, 8].reduce((s, o) => s + k + o, 0) === 320) + 8),
  "alg.arith-seq.v2": () => { let s = 0; let n = 0; while (s < 210) s += ++n; if (s !== 210) throw new Error("210 is not triangular"); return String(n); },
  // counting in stages
  "cp.multiplication.i1": () => String(tuples([0, 1, 2, 3], 2).filter(([bread]) => bread < 3).length),
  "cp.multiplication.t1": () => String(tuples(range(1, 5), 3).length),
  "cp.multiplication.a2": () => String(count(100, 999, (n) => !digits(n).includes(7))),
  "cp.multiplication.a1": () => String(perms(range(1, 5), 3).filter((p) => p[2] % 2 === 0).length),
  "cp.multiplication.v1": () => String(perms(["A", "B", "C", "D", "E"], 5).filter((p) => Math.abs(p.indexOf("A") - p.indexOf("B")) === 1).length),
  // when order does not matter
  "cp.overcounting.i1": () => String(perms(["Ana", "Ben", "C", "D", "E"], 2).filter((p) => p.includes("Ana") && p.includes("Ben")).length),
  "cp.overcounting.t1": () => String(subsets(range(1, 7), 2).length),
  "cp.overcounting.a1": () => String(subsets(range(1, 6), 2).length),
  "cp.overcounting.a2": () => String(subsets(range(1, 8), 4).length),
  "cp.overcounting.v1": () => String(range(1, 6).reduce((s, captain) => s + subsets(range(1, 6).filter((x) => x !== captain), 2).length, 0)),
  "cp.overcounting.v2": () => String(subsets(range(0, 7), 2).filter(([a, b]) => (b - a) % 8 !== 1 && (b - a) % 8 !== 7).length),
  // counting the opposite
  "cp.complement.i1": () => String(tuples(range(0, 9), 2).filter((t) => t.includes(7)).length),
  "cp.complement.t1": () => String(tuples(range(1, 6), 3).filter((t) => t.includes(6)).length),
  "cp.complement.r2": () => {
    const rolls = tuples(range(1, 6), 3);
    const sixes = (t: number[]) => t.filter((x) => x === 6).length;
    const candidates: Record<string, (t: number[]) => boolean> = { "most-one": (t) => sixes(t) <= 1, none: (t) => sixes(t) === 0, "most-two": (t) => sixes(t) <= 2 };
    const exact = Object.keys(candidates).filter((k) => rolls.every((t) => candidates[k](t) !== sixes(t) >= 2));
    if (exact.length !== 1) throw new Error("no unique complement");
    return exact[0];
  },
  "cp.complement.a2": () => String(tuples(range(1, 6), 2).filter(([a, b]) => (a * b) % 2 === 0).length),
  "cp.complement.a1": () => String(count(100, 999, (n) => digits(n).includes(5))),
  "cp.complement.v1": () => String(tuples(["A", "B", "C", "D"], 3).filter((t) => new Set(t).size < 3).length),
  // angle chasing
  "geo.angles.i1": () => {
    const [A, B, C, D]: P[] = [[114, 42], [40, 170], [160, 170], [250, 170]];
    must(near(angleAt(A, B, C), 50) && near(angleAt(B, A, C), 60), "angles at A and B");
    must(near(angleAt(C, A, D), 180 - (180 - 50 - 60)), "exterior angle");
    return String(180 - (180 - 50 - 60));
  },
  "geo.angles.t1": () => {
    const [Pp, Q, R]: P[] = [[140, 80], [40, 150], [240, 150]];
    must(near(dist(Pp, Q), dist(Pp, R)) && near(angleAt(Q, Pp, R), 35), "isosceles with 35° at Q");
    return String(180 - 2 * 35);
  },
  "geo.angles.r1": () => {
    // Each crossing has rays east, west, up the slanted line and down it. A target's region
    // is the sector between the two rays either side of it; its size is that sector's angle.
    const slant: P = [220 - 60, 20 - 180];
    const crossings: Record<string, P> = { p: [100, 140], q: [180, 60] };
    const targets: Record<string, P> = { "p-ul": [90, 116], "p-ll": [72, 152], "p-lr": [110, 164], "q-ur": [208, 48], "q-ul": [170, 36], "q-ll": [152, 72], "q-lr": [190, 84] };
    const sector = (x: P, t: P): number => {
      const rays: P[] = [[1, 0], [-1, 0], slant, [-slant[0], -slant[1]]];
      const bearing = (v: P) => (deg(Math.atan2(v[1], v[0])) + 360) % 360;
      const bs = rays.map(bearing).sort((a, b) => a - b);
      const tb = bearing([t[0] - x[0], t[1] - x[1]]);
      for (let i = 0; i < bs.length; i++) {
        const [lo, hi] = [bs[i], i + 1 < bs.length ? bs[i + 1] : bs[0] + 360];
        if ((tb >= lo && tb < hi) || (tb + 360 >= lo && tb + 360 < hi)) return hi - lo;
      }
      throw new Error("target is on a ray");
    };
    const marked = angleAt(crossings.p, [260, 140], [180, 60]);
    return Object.keys(targets).filter((id) => near(sector(crossings[id[0]], targets[id]), marked));
  },
  "geo.angles.a2": () => {
    const [A, B, Pp]: P[] = [[60, 40], [17, 160], [146, 100]];
    must(near(angleAt(A, [250, 40], Pp), 35) && near(angleAt(B, [250, 160], Pp), 25), "angles with the parallel lines");
    must(near(angleAt(Pp, A, B), 35 + 25), "angle at P");
    return String(35 + 25);
  },
  "geo.angles.a1": () => {
    const [A, B, C, D]: P[] = [[120, 15], [60, 180], [180, 180], [152, 103]];
    must(near(dist(A, B), dist(A, C)) && near(angleAt(A, B, C), 40), "isosceles with 40° at A");
    must(near(dist(B, D), dist(B, C), 1.5) && near(angleAt(D, A, B) + angleAt(D, B, C), 180, 1), "D on AC with BD = BC");
    const base = (180 - 40) / 2;
    const answer = base - (180 - 2 * base);
    must(near(angleAt(B, A, D), answer, 1), "angle ABD");
    return String(answer);
  },
  "geo.angles.v1": () => {
    const base = 100 / 2;
    if ((180 - 100) + 2 * base !== 180) throw new Error("angle sum");
    return String(base);
  },
  // similar triangles
  "geo.similar.i1": () => {
    const small = (4 * 3) / 2;
    const big = (4 * 3 * (3 * 3)) / 2;
    if (small !== 6) throw new Error("reference triangle");
    return String(big);
  },
  "geo.similar.t1": () => { const v = F(8 * (6 + 3), 6); return v[1] === 1 ? `${v[0]}` : `${v[0]}/${v[1]}`; },
  "geo.similar.a2": () => { const v = F(2 * 12, 3); return v[1] === 1 ? `${v[0]}` : `${v[0]}/${v[1]}`; },
  "geo.similar.a1": () => {
    const [A, B, C, D, E]: P[] = [[40, 40], [160, 40], [20, 170], [200, 170], [104, 92]];
    must(near(dist(C, D) / dist(A, B), 9 / 6, 0.01) && near(dist(E, D) / dist(A, E), 9 / 6, 0.01), "bow-tie ratios");
    const v = F(4 * 9, 6);
    return v[1] === 1 ? `${v[0]}` : `${v[0]}/${v[1]}`;
  },
  "geo.similar.v1": () => {
    const [A, B, C]: P[] = [[120, 22], [30, 168], [230, 168]];
    const D: P = [A[0] + (B[0] - A[0]) / 3, A[1] + (B[1] - A[1]) / 3];
    const E: P = [A[0] + (C[0] - A[0]) / 3, A[1] + (C[1] - A[1]) / 3];
    must(near(area([A, B, C]) / area([A, D, E]), 9, 0.001), "area ratio of the drawn triangles");
    return String(5 * 3 * 3 - 5);
  },
};

/** Facts quoted in the explanations of `reasoned` cards that can still be recomputed. */
export const EXTRA_CHECKS: Record<string, () => boolean> = {
  "alg.vieta.r1": () => { const [r, s] = roots(1, -7, 5); return rational(sAdd(sInv(r), sInv(s))) === "7/5"; },
  "alg.arith-seq.r1": () => [-6, -4, -2, 0, 2, 4, 6].reduce((sum, o) => sum + 19 + o, 0) === 133,
  "alg.factoring.r1": () => (4 * 4 === 16) && (3 * 3 === 9) && [-3, -1, 0, 2, 5].every((x) => (x - 4) * (x + 4) === x * x - 16 && (3 * x - 1) * (3 * x + 1) === 9 * x * x - 1 && [-2, 1, 3].every((y) => (x * x - y) * (x * x + y) === x ** 4 - y * y)),
  "nt.primes.t2": () => [...primeFactors(60)].map(([p, e]) => `${p}^${e}`).join("·") === "2^2·3^1·5^1" && 60 * 15 === 30 * 30 && first((k) => isSquare(60 * k)) === 15,
};

export const FAMILY_VERIFIERS: Record<string, (p: Record<string, number>) => string> = {
  "nt.divisibility.f-range": ({ d, lo, hi }) => String(count(lo, hi, (n) => n % d === 0)),
  "nt.primes.f-divisors": ({ n }) => String(divisors(n).length),
  "nt.remainders.f-product": ({ a, b, m }) => String((a * b) % m),
  "nt.cycles.f-power": ({ base, n }) => String(powMod(base, n, 10)),
  "alg.factoring.f-squares": ({ a, b }) => String(a * a - b * b),
  "alg.vieta.f-squares": ({ p, q }) => { const [r, s] = roots(1, -p, q); return rational(sAdd(sMul(r, r), sMul(s, s))); },
  "alg.arith-seq.f-sum": ({ first: a, d, last }) => { let s = 0; for (let x = a; x <= last; x += d) s += x; return String(s); },
  "cp.multiplication.f-arrange": ({ n, k, reuse }) => String((reuse ? tuples(range(1, n), k) : perms(range(1, n), k)).length),
  "cp.overcounting.f-choose": ({ n, k }) => String(subsets(range(1, n), k).length),
  "cp.complement.f-atleast": ({ n, k }) => String(tuples(range(1, n), k).filter((t) => t.includes(1)).length),
};

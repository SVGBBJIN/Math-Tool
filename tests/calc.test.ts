// The step-by-step calculator: every answer is checked against an independent brute-force
// computation, and every step must be valid card markup (so the popup can always render it).
import { describe, expect, it } from "vitest";
import { TOOLS, getTool, runTool, type CalcResult } from "@/lib/calc";
import { evaluate } from "@/lib/calc/arithmetic";
import { choose } from "@/lib/calc/counting";
import { factorize } from "@/lib/calc/number-theory";
import { parseRich, plainText } from "@/lib/learn/cards/markup";

/** Small seeded generator so failures are reproducible. */
function rng(seed: number) {
  let s = seed >>> 0;
  return (lo: number, hi: number) => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return lo + (s % (hi - lo + 1));
  };
}

function run(id: string, values: Record<string, string>): CalcResult {
  const r = runTool(getTool(id)!, values);
  if ("error" in r) throw new Error(`${id} ${JSON.stringify(values)}: ${r.error}`);
  for (const s of r.result.steps) for (const l of [s.title, ...s.lines]) expect(() => parseRich(l), l).not.toThrow();
  expect(() => parseRich(r.result.answer)).not.toThrow();
  return r.result;
}
const answer = (id: string, values: Record<string, string>) => plainText(run(id, values).answer).replace(/,(?=\d{3})/g, "");
const errorOf = (id: string, values: Record<string, string>) => {
  const r = runTool(getTool(id)!, values);
  return "error" in r ? r.error : null;
};

describe("registry", () => {
  it("has unique ids and a working example for every tool", () => {
    expect(new Set(TOOLS.map((t) => t.id)).size).toBe(TOOLS.length);
    for (const t of TOOLS) {
      const r = run(t.id, t.example);
      expect(r.steps.length, t.id).toBeGreaterThan(0);
    }
  });
  it("covers all four areas", () => {
    expect(new Set(TOOLS.map((t) => t.domain))).toEqual(new Set(["Arithmetic", "Number theory", "Counting", "Algebra"]));
  });
});

describe("number theory", () => {
  const r = rng(7);
  it("factorizations multiply back and use primes", () => {
    const isPrime = (p: bigint) => {
      for (let d = 2n; d * d <= p; d++) if (p % d === 0n) return false;
      return p > 1n;
    };
    for (let k = 0; k < 300; k++) {
      const n = BigInt(r(2, 2_000_000));
      const fs = factorize(n);
      expect(fs.reduce((a, [p, e]) => a * p ** BigInt(e), 1n)).toBe(n);
      for (const [p] of fs) expect(isPrime(p)).toBe(true);
    }
    expect(answer("factor", { n: "2520" })).toBe("2520 = 2^3 · 3^2 · 5 · 7");
    expect(answer("factor", { n: "999983" })).toBe("999983 = 999983");
    expect(answer("factor", { n: String(2 ** 39) })).toBe("549755813888 = 2^39");
    expect(errorOf("factor", { n: String(10 ** 12 + 1) })).toMatch(/at most/);
  });

  it("GCD and LCM match brute force", () => {
    for (let k = 0; k < 200; k++) {
      const a = r(1, 5000);
      const b = r(1, 5000);
      let g = 1;
      for (let d = 1; d <= Math.min(a, b); d++) if (a % d === 0 && b % d === 0) g = d;
      let l = Math.max(a, b);
      while (l % a || l % b) l++;
      expect(answer("gcd", { nums: `${a}, ${b}` })).toBe(`GCD(${a}, ${b}) = ${g}, LCM(${a}, ${b}) = ${l}`);
    }
    expect(answer("gcd", { nums: "12, 18, 30" })).toBe("GCD(12, 18, 30) = 6, LCM(12, 18, 30) = 180");
  });

  it("divisor count and sum match brute force", () => {
    for (let k = 0; k < 200; k++) {
      const n = r(2, 100_000);
      let count = 0;
      let sum = 0;
      for (let d = 1; d <= n; d++) if (n % d === 0) {
        count++;
        sum += d;
      }
      expect(answer("divisors", { n: String(n) })).toBe(`${count} divisors, with sum ${sum}`);
    }
  });

  it("powers mod m match direct computation (cycle and squaring paths)", () => {
    for (let k = 0; k < 300; k++) {
      const a = r(-50, 500);
      const b = r(0, 5000);
      const mod = k % 3 === 0 ? r(1000, 1_000_000) : r(2, 120);
      const want = (((BigInt(a) % BigInt(mod)) + BigInt(mod)) % BigInt(mod)) ** BigInt(b) % BigInt(mod);
      const got = answer("modpow", { a: String(a), b: String(b), m: String(mod) });
      expect(got.split("≡ ")[1], `${a}^${b} mod ${mod}`).toBe(`${want} (mod ${mod})`);
    }
    expect(answer("modpow", { a: "7", b: "2026", m: "100" })).toBe("7^2026 ≡ 49 (mod 100)");
  });
});

describe("counting", () => {
  it("C(n, k) matches Pascal's triangle and P(n, k) the product", () => {
    const pascal: bigint[][] = [[1n]];
    for (let n = 1; n <= 60; n++) pascal.push(Array.from({ length: n + 1 }, (_, k) => (pascal[n - 1][k - 1] ?? 0n) + (pascal[n - 1][k] ?? 0n)));
    for (let n = 0; n <= 60; n++) for (let k = 0; k <= n; k++) expect(choose(BigInt(n), BigInt(k))).toBe(pascal[n][k]);
    expect(answer("choose", { kind: "c", n: "52", k: "5" })).toBe("C(52, 5) = 2598960");
    expect(answer("choose", { kind: "c", n: "10", k: "8" })).toBe("C(10, 8) = 45");
    expect(answer("choose", { kind: "p", n: "10", k: "3" })).toBe("P(10, 3) = 720");
    expect(answer("choose", { kind: "c", n: "5", k: "0" })).toBe("C(5, 0) = 1");
  });

  it("arrangements match brute-force distinct permutations", () => {
    const distinct = (w: string) => {
      const seen = new Set<string>();
      const go = (pre: string, rest: string) => {
        if (!rest) return void seen.add(pre);
        for (let i = 0; i < rest.length; i++) go(pre + rest[i], rest.slice(0, i) + rest.slice(i + 1));
      };
      go("", w);
      return seen.size;
    };
    for (const w of ["BANANA", "AABB", "LEVEL", "ABCDE", "AAAA", "MAMMAL"]) expect(answer("arrange", { items: w })).toBe(`${distinct(w)} arrangements`);
    expect(answer("arrange", { items: "MISSISSIPPI" })).toBe("34650 arrangements");
    expect(answer("arrange", { items: "3, 2, 1" })).toBe("60 arrangements");
  });

  it("stars and bars matches brute-force enumeration", () => {
    const brute = (n: number, k: number, min: number): number => (k === 1 ? (n >= min ? 1 : 0) : Array.from({ length: n + 1 }, (_, x) => (x >= min ? brute(n - x, k - 1, min) : 0)).reduce((a, b) => a + b, 0));
    for (let n = 0; n <= 12; n++) for (let k = 1; k <= 5; k++) {
      expect(answer("stars", { rule: "0", n: String(n), k: String(k) })).toBe(`${brute(n, k, 0)} ways`);
      expect(answer("stars", { rule: "1", n: String(n), k: String(k) })).toBe(`${brute(n, k, 1)} ways`);
    }
  });
});

describe("arithmetic", () => {
  const val = (src: string) => {
    const v = evaluate(src).value;
    return v.d === 1n ? `${v.n}` : `${v.n}/${v.d}`;
  };
  it("evaluates with the usual order of operations, exactly", () => {
    expect(val("3/4 + 5/6")).toBe("19/12");
    expect(val("1 + 2 * 3")).toBe("7");
    expect(val("(1 + 2) * 3")).toBe("9");
    expect(val("-2^2")).toBe("-4");
    expect(val("(-2)^2")).toBe("4");
    expect(val("2^3^2")).toBe("512");
    expect(val("2^-3")).toBe("1/8");
    expect(val("(2/3)^-2")).toBe("9/4");
    expect(val("12 * 3/4")).toBe("9");
    expect(val("12 ÷ 3/4")).toBe("16");
    expect(val("12 / 3 / 4")).toBe("1");
    expect(val("2^3/4")).toBe("2");
    expect(val("0.25 + 1/8")).toBe("3/8");
    expect(val("2(3 + 4)")).toBe("14");
    expect(val("(1/2)(1/3)")).toBe("1/6");
    expect(val("1 - -1")).toBe("2");
    expect(val("6/8")).toBe("3/4");
    expect(val("1,000,000 * 1,000,000")).toBe("1000000000000");
  });
  it("matches floating-point evaluation on random expressions", () => {
    const r = rng(11);
    const ops = ["+", "-", "*", "/"];
    for (let k = 0; k < 300; k++) {
      let src = `${r(1, 30)}`;
      for (let j = 0; j < r(1, 5); j++) src += ` ${ops[r(0, 3)]} (${r(1, 20)} ${ops[r(0, 1)]} ${r(1, 9)})`;
      const f = Function(`return ${src}`)() as number;
      if (!Number.isFinite(f)) {
        expect(() => evaluate(src)).toThrow(/divides by zero/);
        continue;
      }
      const v = evaluate(src).value;
      expect(Number(v.n) / Number(v.d), src).toBeCloseTo(f, 6);
    }
  });
  it("shows decimals, including repeating ones", () => {
    expect(answer("expr", { expr: "1/7" })).toContain("0.(142857)");
    expect(answer("expr", { expr: "7/4" })).toContain("1 3/4");
  });
  it("explains bad input instead of crashing", () => {
    expect(errorOf("expr", { expr: "1/0" })).toMatch(/divides by zero/);
    expect(errorOf("expr", { expr: "1 / (2 - 2)" })).toMatch(/divides by zero/);
    expect(errorOf("expr", { expr: "(1 + 2" })).toMatch(/never closed/);
    expect(errorOf("expr", { expr: "2^(1/2)" })).toMatch(/whole numbers/);
    expect(errorOf("expr", { expr: "x + 1" })).toMatch(/isn't something/);
    expect(errorOf("expr", { expr: "" })).toMatch(/Enter/);
  });
  it("converts bases both ways", () => {
    const r = rng(3);
    for (let k = 0; k < 200; k++) {
      const n = r(0, 1_000_000);
      const from = r(2, 36);
      const to = r(2, 36);
      const got = answer("base", { n: n.toString(from), from: String(from), to: String(to) });
      expect(got.split(" = ")[1].replace(/\s/g, "")).toBe(`${n.toString(to).toUpperCase()}_${to}`);
    }
    expect(errorOf("base", { n: "129", from: "2", to: "10" })).toMatch(/can't appear in base 2/);
  });
});

describe("algebra", () => {
  it("quadratic roots satisfy the equation", () => {
    expect(answer("quadratic", { a: "1", b: "-5", c: "6" })).toBe("x = 3 or x = 2");
    expect(answer("quadratic", { a: "1", b: "-6", c: "4" })).toBe("x = 3 ± √5");
    expect(answer("quadratic", { a: "2", b: "4", c: "2" })).toBe("x = −1 (double root)");
    expect(answer("quadratic", { a: "1", b: "0", c: "4" })).toBe("x = ± 2i (no real roots)");
    expect(answer("quadratic", { a: "1/2", b: "-1/3", c: "-1" })).toBe("x = (1 ± √19)/3");
    const r = rng(5);
    for (let k = 0; k < 200; k++) {
      const [a, b, c] = [r(1, 30) * (r(0, 1) ? 1 : -1), r(-40, 40), r(-40, 40)];
      const res = run("quadratic", { a: String(a), b: String(b), c: String(c) });
      const D = b * b - 4 * a * c;
      const text = res.steps.flatMap((s) => s.lines).join(" ");
      if (D > 0 && Math.sqrt(D) % 1 !== 0) {
        // The approximate roots must solve the equation.
        const approx = [...plainText(text).matchAll(/x ≈ ([−-]?\d+(?:\.\d+)?)/g)].map((mm) => Number(mm[1].replace(/−/g, "-")));
        expect(approx.length).toBe(2);
        for (const x of approx) expect(Math.abs(a * x * x + b * x + c)).toBeLessThan(1e-3 * Math.max(1, Math.abs(a), Math.abs(b), Math.abs(c)));
      } else if (D >= 0) {
        const roots = [...plainText(res.answer).matchAll(/x = (−?)(\d+)(?:\/(\d+))?/g)].map((mm) => (mm[1] ? -1 : 1) * Number(mm[2]) / Number(mm[3] ?? 1));
        expect(roots.length).toBeGreaterThan(0);
        for (const x of roots) expect(Math.abs(a * x * x + b * x + c)).toBeLessThan(1e-9);
      }
    }
    expect(errorOf("quadratic", { a: "0", b: "1", c: "1" })).toMatch(/linear/);
  });

  it("linear systems: unique, none, infinitely many", () => {
    expect(answer("system", { eqs: "2x + 3y = 7\nx - y = 1" })).toBe("x = 2, y = 1");
    expect(answer("system", { eqs: "x + y + z = 6\n2x - y + z = 3\nx + 2y - z = 2" })).toBe("x = 1, y = 2, z = 3");
    expect(answer("system", { eqs: "1/2x + 1/3y = 1\n0.5x - y = -3" })).toBe("x = 0, y = 3");
    expect(answer("system", { eqs: "3x = 2y + 1\ny = x - 1" })).toBe("x = −1, y = −2");
    expect(answer("system", { eqs: "x + y = 1\n2x + 2y = 3" })).toBe("No solution");
    expect(answer("system", { eqs: "x + y = 1\n2x + 2y = 2" })).toBe("Infinitely many solutions (y free)");
    const r = rng(9);
    for (let k = 0; k < 150; k++) {
      const n = r(2, 4);
      const vars = ["w", "x", "y", "z"].slice(0, n);
      const sol = vars.map(() => r(-9, 9));
      const rows = vars.map(() => vars.map(() => r(-6, 6)));
      const text = rows.map((cf) => `${cf.map((c, j) => `${c >= 0 ? "+" : "-"}${Math.abs(c)}${vars[j]}`).join("")} = ${cf.reduce((s, c, j) => s + c * sol[j], 0)}`).join("\n");
      const got = answer("system", { eqs: text });
      if (got.startsWith("x") || got.startsWith("w")) expect(got, text).toBe(vars.map((x, j) => `${x} = ${sol[j] < 0 ? "−" : ""}${Math.abs(sol[j])}`).join(", "));
      else expect(got, text).toMatch(/Infinitely many/); // singular random matrix: the planted solution still exists
    }
    expect(errorOf("system", { eqs: "2(x + y) = 3" })).toMatch(/can't read/);
  });

  it("series match direct summation", () => {
    expect(answer("arith-series", { a: "5", d: "3", last: "302" })).toBe("Sum = 15350 (100 terms)");
    expect(answer("arith-series", { a: "1", d: "1", n: "100" })).toBe("Sum = 5050 (100 terms)");
    expect(errorOf("arith-series", { a: "1", d: "2", last: "10" })).toMatch(/never lands/);
    const r = rng(2);
    for (let k = 0; k < 100; k++) {
      const [a, d, n] = [r(-50, 50), r(-9, 9), r(1, 60)];
      let s = 0;
      for (let j = 0; j < n; j++) s += a + j * d;
      expect(answer("arith-series", { a: String(a), d: String(d), n: String(n) })).toBe(`Sum = ${s < 0 ? "−" : ""}${Math.abs(s)} (${n} terms)`);
    }
    expect(answer("geo-series", { a: "3", r: "2", n: "10" })).toBe("S = 3069");
    expect(answer("geo-series", { a: "1", r: "1/2", n: "∞" })).toBe("S = 2");
    expect(answer("geo-series", { a: "1", r: "1/2", n: "4" })).toBe("S = 15/8");
    expect(answer("geo-series", { a: "1", r: "-1/3", n: "inf" })).toBe("S = 3/4");
    expect(answer("geo-series", { a: "1", r: "2", n: "inf" })).toMatch(/No finite sum/);
  });
});

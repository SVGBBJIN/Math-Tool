import { describe, expect, it } from "vitest";
import { generateProblem, nextLevel, type Kind, type Level, type ScrollProblem } from "@/lib/scroll";
import { shouldNag } from "@/lib/nag";

// Independent re-solvers, computed by brute force from the recorded params.
const SOLVE: Record<Kind, (p: Record<string, number>) => number> = {
  mult: (p) => { let s = 0; for (let i = 0; i < p.b; i++) s += p.a; return s; },
  percent: (p) => { let t = 0; for (let i = 0; i < p.y; i++) t += p.p; return t / 100; },
  successive: (p) => { const up = p.y + (p.y * p.up) / 100; return up - (up * p.down) / 100; },
  linear: (p) => { for (let x = -100; x <= 100; x++) if (p.a * x + p.b === p.c) return x; return NaN; },
  exp: (p) => { let v = 1; for (let i = 0; i < p.a + p.b - p.c; i++) v *= p.base; return v; },
  remainder: (p) => p.N % 9,
  units: (p) => { let v = 1; for (let i = 0; i < p.n; i++) v = (v * p.base) % 10; return v; },
  handshake: (p) => { let c = 0; for (let i = 0; i < p.n; i++) for (let j = i + 1; j < p.n; j++) c++; return c; },
  sumTo: (p) => { let s = 0; for (let i = 1; i <= p.n; i++) s += i; return s; },
  oddsum: (p) => { let s = 0; for (let i = 0; i < p.n; i++) s += 2 * i + 1; return s; },
  mean: (p) => 5 * p.m - p.a - p.b - p.c - p.d,
  square: (p) => (p.P / 4) ** 2,
  pythag: (p) => Math.round(Math.sqrt(p.x ** 2 + p.y ** 2)),
  divisors: (p) => { const N = p.p ** p.a * p.q ** p.b; let c = 0; for (let i = 1; i <= N; i++) if (N % i === 0) c++; return c; },
  arrange: (p) => { let f = 1; for (let i = 2; i <= p.n; i++) f *= i; return f; },
  nth: (p) => { let t = p.a; for (let i = 1; i < p.n; i++) t += p.d; return t; },
};

const levels: Level[] = [1, 2, 3];

describe("generateProblem", () => {
  it("is deterministic per seed", () => {
    expect(generateProblem(42, 2)).toEqual(generateProblem(42, 2));
  });

  it("builds valid, independently-verified problems across seeds and levels", () => {
    const kinds = new Set<Kind>();
    for (const level of levels) {
      for (let seed = 1; seed <= 400; seed++) {
        const p: ScrollProblem = generateProblem(seed, level);
        kinds.add(p.kind);
        expect(p.choices).toHaveLength(4);
        expect(new Set(p.choices).size).toBe(4);
        expect(p.choices.every((c) => /^\d+$/.test(c))).toBe(true);
        expect(p.choices[p.answerIndex]).toBe(String(p.answer));
        expect(SOLVE[p.kind](p.params), `${p.kind} seed ${seed} level ${level}`).toBe(p.answer);
        expect(p.explanation.length).toBeGreaterThan(10);
      }
    }
    expect(kinds.size).toBe(16);
  });
});

describe("nextLevel", () => {
  it("levels up after 3 right, down after 2 misses, clamped", () => {
    expect(nextLevel(1, [true, true, true])).toBe(2);
    expect(nextLevel(3, [true, true, true])).toBe(3);
    expect(nextLevel(2, [true, false, false])).toBe(1);
    expect(nextLevel(1, [false, false])).toBe(1);
    expect(nextLevel(2, [true, false])).toBe(2);
  });
});

describe("shouldNag (separate from practice)", () => {
  it("never nags when the toggle is off, even with work left", () => {
    expect(shouldNag({ textsEnabled: false, status: { complete: false } })).toBe(false);
  });
  it("nags only while the day is incomplete when on", () => {
    expect(shouldNag({ textsEnabled: true, status: { complete: false } })).toBe(true);
    expect(shouldNag({ textsEnabled: true, status: { complete: true } })).toBe(false);
  });
});

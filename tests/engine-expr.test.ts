import { describe, expect, it } from "vitest";
import { parseExpr, show } from "@/lib/engine/expr/ast";
import { applyExprMove } from "@/lib/engine/expr/moves";
import { exprGoalReached, type ExprGoal } from "@/lib/engine/expr/module";
import { parseState, showState, type ExprState } from "@/lib/engine/expr/state";
import { verifyStep } from "@/lib/engine/expr/verify";

const st = parseState;
/** Apply a move and return the printed line, or "✗ reason". */
function go(start: string | ExprState, move: string, params: Record<string, string | number> = {}, target = {}) {
  const s = typeof start === "string" ? st(start) : start;
  const r = applyExprMove(s, move, Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])), target);
  return r.ok ? showState(r.state) : `✗ ${r.reason}`;
}
const ok = (a: string, b: string) => verifyStep(st(a), st(b));

describe("expressions: parse and print", () => {
  it("round-trips what the student sees", () => {
    for (const src of ["x^2+7x+12", "3x(2x-3)", "(x-4)(x+3)", "-x^2+4", "(x+3)^2-16", "2x^2+6x+x+3", "x(x-4)+3(x-4)", "-3+sqrt(7)", "25x^2-4y^2", "(x^4+4x^2+4)-4x^2"]) {
      const once = show(parseExpr(src));
      expect(show(parseExpr(once))).toBe(once);
    }
    expect(show(parseExpr("x^2-5x+6"))).toBe("x² − 5x + 6");
    expect(show(parseExpr("2*3x"))).toBe("2·3x");
  });
});

describe("Module A verifier: valid moves pass", () => {
  it("factoring moves", () => {
    expect(go("6x^2+9x", "gcf", { f: "3x" })).toBe("3x(2x + 3)");
    expect(go("x^2-25", "diff_squares", { A: "x", B: 5 })).toBe("(x − 5)(x + 5)");
    expect(go("x^2+7x+12", "trinomial", { p: 3, q: 4 })).toBe("(x + 3)(x + 4)");
    expect(go("2x^2+7x+3", "split_middle", { p: 6, q: 1 })).toBe("2x² + 6x + x + 3");
    expect(go("2x^2+6x+x+3", "group")).toBe("(2x + 1)(x + 3)");
    expect(go("x^2+6x+9", "perfect_square", { A: "x", B: 3 })).toBe("(x + 3)²");
    expect(go("x^2+6x+11", "complete_square", { h: 3, k: 2 })).toBe("(x + 3)² + 2");
    expect(go("(x+2)(x-5)", "expand")).toBe("x² − 3x − 10");
  });
  it("a move can target one factor", () => {
    expect(go("(x^2-9)(x^2+9)", "diff_squares", { A: "x", B: 3 }, { part: 0 })).toBe("(x − 3)(x + 3)(x² + 9)");
  });
  it("add-and-subtract sets up a hidden difference of squares", () => {
    const a = applyExprMove(st("x^4+4"), "add_subtract", { t: "4x^2" });
    expect(a.ok && showState(a.state)).toBe("(x⁴ + 4 + 4x²) − 4x²");
    const b = a.ok ? applyExprMove(a.state, "perfect_square", { A: "x^2", B: "2" }, { part: 0 }) : a;
    expect(b.ok && showState(b.state)).toBe("(x² + 2)² − 4x²");
    const c = b.ok ? applyExprMove(b.state, "diff_squares", { A: "x^2+2", B: "2x" }) : b;
    expect(c.ok && showState(c.state)).toBe("(x² + 2 − 2x)(x² + 2 + 2x)");
  });
  it("substitution is checked through the substitution", () => {
    const a = applyExprMove(st("x^4-13x^2+36"), "substitute", { T: "x^2" });
    expect(a.ok && showState(a.state)).toBe("u² − 13u + 36   [u = x²]");
    const b = a.ok ? applyExprMove(a.state, "trinomial", { p: "-4", q: "-9" }) : a;
    const c = b.ok ? applyExprMove(b.state, "back_substitute") : b;
    expect(c.ok && showState(c.state)).toBe("(x² − 4)(x² − 9)");
    // A wrong pair is caught while still in u.
    expect(a.ok && go(a.state, "trinomial", { p: -6, q: -6 })).toMatch(/^✗ −6 \+ −6 = −12 and −6·−6 = 36; you need sum −13/);
  });
  it("equation moves", () => {
    expect(go("x^2=5x+14", "to_zero")).toBe("x² − 5x − 14 = 0");
    expect(go("x^2+6x=7", "add_both", { t: 9 })).toBe("x² + 6x + 9 = 16");
    expect(go("2x^2-8=0", "div_both", { t: 2 })).toBe("x² − 4 = 0");
    expect(go("(x-2)(x-3)=0", "zero_product")).toBe("x − 2 = 0  or  x − 3 = 0");
    expect(go("(x+3)^2=16", "sqrt_both", { sign: "both" })).toBe("x + 3 = 4  or  x + 3 = −4");
    expect(go("(x+3)^2=7", "sqrt_both", { sign: "both" })).toBe("x + 3 = √7  or  x + 3 = −√7");
    expect(go("x+3=sqrt(7) or x+3=-sqrt(7)", "solve_linear")).toBe("x = −3 + √7  or  x = −3 − √7");
    expect(go("2x-3=0 or x+5=0", "solve_linear")).toBe("x = 3/2  or  x = −5");
  });
  it("a repeated root may be written once", () => {
    expect(go("(x-3)^2=0", "zero_product")).toBe("x − 3 = 0");
    expect(go("x(x^2-6x+9)=0", "perfect_square", { A: "x", B: -3 }, { eq: 0, side: "lhs", part: 1 })).toBe("x(x − 3)² = 0");
    expect(ok("x^2-6x+9=0", "x-3=0").ok).toBe(true);
  });
});

describe("Module A verifier: moves that look valid but are not", () => {
  it("a sum of squares is not a difference of squares", () => {
    expect(go("x^2+9", "diff_squares", { A: "x", B: 3 })).toBe("✗ That multiplies out to x² − 9, not x² + 9.");
  });
  it("the square of a sum is not the sum of the squares", () => {
    const r = ok("(x+3)^2", "x^2+9");
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toMatch(/^Not equal: at x = 1 the previous line is 16 but this is 10/);
    expect(go("x^2+9", "perfect_square", { A: "x", B: 3 })).toMatch(/^✗ That multiplies out to x² \+ 6x \+ 9/);
  });
  it("the right product with the wrong sum", () => {
    expect(go("x^2+7x+12", "trinomial", { p: 2, q: 6 })).toBe("✗ 2 + 6 = 8 and 2·6 = 12; you need sum 7 and product 12.");
    expect(go("x^2-5x+6", "trinomial", { p: 2, q: 3 })).toMatch(/you need sum −5 and product 6/);
  });
  it("the sum-product shortcut on a leading coefficient that is not 1", () => {
    expect(go("2x^2+7x+3", "trinomial", { p: 1, q: 3 })).toMatch(/needs a leading coefficient of 1/);
  });
  it("a split that does not add to the middle term", () => {
    expect(go("2x^2+7x+3", "split_middle", { p: 2, q: 3 })).toBe("✗ 2 + 3 = 5, but the middle term is 7x.");
  });
  it("a valid split that cannot be grouped", () => {
    expect(go("2x^2+7x+3", "split_middle", { p: 5, q: 2 })).toBe("2x² + 5x + 2x + 3");
    expect(go("2x^2+5x+2x+3", "group")).toMatch(/^✗ The pairs give x\(2x \+ 5\) and \(2x \+ 3\): no shared bracket/);
  });
  it("a factor that does not divide every term", () => {
    expect(go("6x^2+10", "gcf", { f: "3x" })).toBe("✗ 3x doesn't divide every term of 6x² + 10.");
    // It would "work" with a fraction inside the bracket; that is not a common factor.
    expect(go("4x^2+12x", "gcf", { f: "3x" })).toBe("✗ 3x doesn't divide every term of 4x² + 12x.");
    expect(go("4x^2+12x", "gcf", { f: "2x" })).toBe("2x(2x + 6)"); // valid, just not finished
  });
  it("dividing both sides by x loses a root", () => {
    expect(go("x^2=5x", "div_both", { t: "x" })).toBe("✗ x can be 0, so dividing by it is not safe. This loses the solution x = 0.");
  });
  it("taking only the positive square root loses a root", () => {
    expect(go("(x+3)^2=16", "sqrt_both", { sign: "plus" })).toBe("✗ Both the positive and the negative root square to the same number. This loses the solution x = −7.");
    expect(ok("x^2=9", "x=3").ok).toBe(false);
  });
  it("the zero-product rule without zero", () => {
    expect(go("(x-2)(x+3)=6", "zero_product")).toMatch(/^✗ The zero-product rule needs 0 on the other side/);
  });
  it("squaring both sides adds a root", () => {
    const r = ok("x=3", "x^2=9");
    expect(!r.ok && r.reason).toBe("This adds x = −3, which doesn't satisfy the previous line.");
  });
  it("dropping a term, or a sign", () => {
    expect(ok("x^2+6x=7", "x^2=7").ok).toBe(false);
    expect(ok("x^2-5x+6=0", "(x+2)(x+3)=0").ok).toBe(false);
    expect(ok("x-2=0 or x-3=0", "x=2 or x=-3").ok).toBe(false);
  });
  it("cancelling introduces a point where the line is undefined", () => {
    const r = ok("x", "x^2/x");
    expect(r.ok).toBe(false);
    expect(!r.ok && r.domain).toBe(true);
    expect(!r.ok && r.reason).toMatch(/undefined when x = 0/);
  });
  it("a square can never equal a negative number", () => {
    expect(go("(x+1)^2=-4", "sqrt_both", { sign: "both" })).toMatch(/no real solutions/);
  });
  it("a no-op is refused without being called wrong", () => {
    const r = applyExprMove(st("x^2-5x+6"), "expand");
    expect(r.ok).toBe(false);
    expect(!r.ok && r.noop).toBe(true);
  });
  it("substituting a chunk that does not cover the variable", () => {
    expect(go("x^4-13x^2+36x", "substitute", { T: "x^2" })).toMatch(/can't be written using only x²/);
  });
});

describe("Module A: congruences", () => {
  it("reduces bases, never exponents", () => {
    expect(go("17^5+23x mod 5", "reduce_mod")).toBe("2⁵ + 3x  (mod 5)");
    expect(ok("2^10 mod 7", "2^3 mod 7").ok).toBe(false); // exponent reduced mod 7: wrong
  });
  it("checks a claimed cycle length instead of trusting it", () => {
    expect(go("7^2026 mod 10", "cycle", { len: 4 })).toBe("7²  (mod 10)");
    expect(go("7^2026 mod 10", "cycle", { len: 2 })).toMatch(/^✗ Powers of 7 don't repeat every 2 steps mod 10/);
    expect(go("7^2 mod 10", "evaluate_mod")).toBe("9  (mod 10)");
  });
});

describe("Module A goals", () => {
  it("fully factored means every factor matches the key", () => {
    const goal: ExprGoal = { type: "factored", final: "4x(x+3)" };
    expect(exprGoalReached(goal, st("2x(2x+6)"))).toBe(false); // equivalent, but 2x + 6 still factors
    expect(exprGoalReached(goal, st("4x(x+3)"))).toBe(true);
    expect(exprGoalReached(goal, st("(x+3)·4x"))).toBe(true);
    expect(exprGoalReached(goal, st("4x^2+12x"))).toBe(false);
  });
  it("solved means every branch reads x = value, with all the roots", () => {
    const goal: ExprGoal = { type: "solved", solutions: ["2", "3"] };
    expect(exprGoalReached(goal, st("x=3 or x=2"))).toBe(true);
    expect(exprGoalReached(goal, st("x=2"))).toBe(false);
    expect(exprGoalReached(goal, st("x-2=0 or x-3=0"))).toBe(false);
  });
});

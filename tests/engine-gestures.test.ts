import { describe, expect, it } from "vitest";
import { applyExprMove, EXPR_MOVES, EXPR_TOOLBOX } from "@/lib/engine/expr/moves";
import { parseState, showState, type ExprState } from "@/lib/engine/expr/state";
import { getCard } from "@/lib/engine/registry";
import { applyStructMove, checkStructure, parseCount, type StructCard, type StructState } from "@/lib/engine/struct/module";

const S = (src: string) => parseState(src);
function ok(src: string, move: string, params: Record<string, string> = {}, target = {}) {
  const r = applyExprMove(S(src), move, params, target);
  if (!r.ok) throw new Error(`${move} on ${src}: ${r.reason}`);
  return { line: showState(r.state as ExprState), why: r.why };
}
function bad(src: string, move: string, params: Record<string, string> = {}, target = {}) {
  const r = applyExprMove(S(src), move, params, target);
  expect(r.ok, `${move} on ${src} should be rejected`).toBe(false);
  return r as Extract<typeof r, { ok: false }>;
}

describe("direct manipulation: combine like terms (tap one, then the other)", () => {
  it("adds coefficients of like terms and says why", () => {
    const r = ok("x^2+3x+4x+12", "combine", { i: "1", j: "2" });
    expect(r.line).toBe("x² + 7x + 12");
    expect(r.why).toMatch(/same power/);
  });
  it("works in either tap order and on the right side of an equation", () => {
    expect(ok("x^2+3x+4x+12", "combine", { i: "2", j: "1" }).line).toBe("x² + 7x + 12");
    expect(ok("x = 2x+5+3", "combine", { i: "1", j: "2" }, { eq: 0, side: "rhs" }).line).toBe("x = 2x + 8");
  });
  it("looks valid but isn't: 3x and 3x² are not like terms", () => {
    expect(bad("3x^2+3x", "combine", { i: "0", j: "1" }).reason).toMatch(/aren't like terms/);
  });
  it("looks valid but isn't: x and a constant", () => {
    expect(bad("x+5", "combine", { i: "0", j: "1" }).reason).toMatch(/aren't like terms/);
  });
  it("a term can't be combined with itself", () => {
    expect(bad("x+5", "combine", { i: "0", j: "0" }).reason).toMatch(/two different/);
  });
});

describe("direct manipulation: drag a term across the = sign", () => {
  it("the app flips the sign, and the verifier accepts the result", () => {
    const r = ok("x^2 = 5x+14", "move_across", { i: "0" }, { eq: 0, side: "rhs" });
    expect(r.line).toBe("x² − 5x = 14");
    expect(r.why).toMatch(/sign flipped/);
  });
  it("moving the last term leaves 0 behind", () => {
    expect(ok("x^2-5x = 14", "move_across", { i: "0" }, { eq: 0, side: "rhs" }).line).toBe("x² − 5x − 14 = 0");
  });
  it("a negative term comes across positive", () => {
    expect(ok("x^2-9 = 0", "move_across", { i: "1" }, { eq: 0, side: "lhs" }).line).toBe("x² = 9");
  });
  it("only acts on equations", () => {
    expect(bad("x^2+5x", "move_across", { i: "1" }).reason).toMatch(/doesn't act on a bare expression/);
  });
});

describe("direct manipulation: regroup terms", () => {
  it("moves a term to a new place without changing the value", () => {
    expect(ok("x^3-18+2x^2-9x", "reorder", { i: "1", to: "4" }).line).toBe("x³ + 2x² − 9x − 18");
  });
  it("then grouping works where it didn't before", () => {
    const before = applyExprMove(S("x^3-18+2x^2-9x"), "group");
    expect(before.ok).toBe(false);
    expect(ok("x^3+2x^2-9x-18", "group").line).toBe("(x² − 9)(x + 2)");
  });
});

describe("the standing toolbox", () => {
  it("every move has Level 1 and Level 2 text and a confirmation line", () => {
    for (const m of EXPR_MOVES) {
      expect(m.kind.length, m.id).toBeGreaterThan(3);
      expect(m.goal.length, m.id).toBeGreaterThan(3);
      expect(m.why.length, m.id).toBeGreaterThan(3);
    }
  });
  it("gestures are not tiles, and nothing in it is a typed-name alias or a choice list", () => {
    const ids = EXPR_TOOLBOX.map((m) => m.id);
    expect(ids).not.toContain("combine");
    expect(ids).not.toContain("move_across");
    for (const m of EXPR_TOOLBOX) for (const p of m.params) expect(["int", "term", "toggle"]).toContain(p.kind);
    expect(EXPR_TOOLBOX.some((m) => "aliases" in m)).toBe(false);
  });
  it("a tile that can't act on this kind of line is refused without counting as a wrong move", () => {
    const r = bad("x^2+5x", "zero_product");
    expect(r.noop).toBe(true);
  });
  it("the ± root is a toggle: switching it off loses a root and is caught", () => {
    expect(ok("(x-2)^2 = 9", "sqrt_both", { sign: "both" }).line).toBe("x − 2 = 3  or  x − 2 = −3");
    expect(bad("(x-2)^2 = 9", "sqrt_both", { sign: "plus" }).reason).toMatch(/negative root/);
  });
  it("a correct step locks in with a reason that uses the student's numbers", () => {
    expect(ok("6x^2+9x", "gcf", { f: "3x" }).why).toMatch(/3x divides every term/);
    expect(ok("x^2+7x+12", "trinomial", { p: "3", q: "4" }).why).toMatch(/3 \+ 4 = 7 and 3·4 = 12/);
  });
});

// ---- Module B: counts are typed by the student and checked at once ------------------------
const books = getCard("count.arrange.r1") as StructCard; // 6 books, 2 spots
const pairs = getCard("count.committee.w") as StructCard; // 5 students, pairs
const empty: StructState = { terms: [] };
function place(card: StructCard, s: StructState, slot: string, count: string) {
  return applyStructMove(card, s, "slot", { slot, count });
}

describe("Module B: typed counts", () => {
  it("parses keypad counts with ! and ×", () => {
    expect(parseCount("24")).toBe(24);
    expect(parseCount("4!")).toBe(24);
    expect(parseCount("2×4!")).toBe(48);
    expect(parseCount("2x3")).toBe(6);
    expect(parseCount("abc")).toBeNull();
    expect(parseCount("")).toBeNull();
  });
  it("a correct count locks in with a reason", () => {
    const r = place(books, empty, "fresh", "6");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.why).toMatch(/6 options/);
  });
  it("looks valid but isn't: the starting count in the second slot", () => {
    const one = place(books, empty, "fresh", "6");
    if (!one.ok) throw new Error();
    const r = place(books, one.state, "fresh", "6");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/earlier slots have used some up/);
  });
  it("too many and too few are told apart, without giving the number away", () => {
    const tooMany = place(books, empty, "fresh", "9");
    const tooFew = place(books, empty, "fresh", "3");
    expect(!tooMany.ok && tooMany.reason).toMatch(/Too many/);
    expect(!tooFew.ok && tooFew.reason).toMatch(/Too few/);
    expect(!tooMany.ok && tooMany.reason).not.toMatch(/\b6\b/);
  });
  it("an unreadable count is refused but not counted as wrong", () => {
    const r = place(books, empty, "fresh", "x");
    expect(!r.ok && r.noop).toBe(true);
  });
  it("a typed divisor maps to the symmetry it matches", () => {
    let s = empty;
    for (const c of ["5", "4"]) {
      const r = place(pairs, s, "fresh", c);
      if (!r.ok) throw new Error(r.reason);
      s = r.state;
    }
    const d = applyStructMove(pairs, s, "divide", { value: "2" });
    if (!d.ok) throw new Error(d.reason);
    expect(d.state.terms[0].div).toBe("kfact");
    expect(checkStructure(pairs, d.state).ok).toBe(true);
  });
  it("looks valid but isn't: dividing pairs by 4 (a number no symmetry explains) gets a counterexample on the right part", () => {
    let s = empty;
    for (const c of ["5", "4"]) {
      const r = place(pairs, s, "fresh", c);
      if (!r.ok) throw new Error(r.reason);
      s = r.state;
    }
    const d = applyStructMove(pairs, s, "divide", { value: "4" });
    if (!d.ok) throw new Error(d.reason);
    expect(d.state.terms[0].div).toBe("lit:4");
    const r = checkStructure(pairs, d.state);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.part).toBe(0);
      expect(r.detail.join(" ")).toMatch(/built 2 times, not 4/);
    }
  });
  it("an unfinished structure's counterexample shows the empty spot", () => {
    const one = place(books, empty, "fresh", "6");
    if (!one.ok) throw new Error();
    const r = checkStructure(books, one.state);
    expect(!r.ok && r.detail.join(" ")).toMatch(/"A_"/);
  });
});

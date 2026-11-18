import { describe, expect, it } from "vitest";
import { CARDS, FAMILIES, getCard, familyOf, cardsOf } from "@/lib/learn/cards";
import { check, unfactored } from "@/lib/learn/cards/check";
import { parseRich, plainText, MarkupError } from "@/lib/learn/cards/markup";
import { validateCard } from "@/lib/learn/cards/validate";
import { parseExpr } from "@/lib/learn/math/ast";
import { parseRational, rShow } from "@/lib/learn/math/rational";
import type { Card } from "@/lib/learn/cards/types";
import { VERIFIERS } from "@/lib/learn/content/verifiers";

describe("exact numbers", () => {
  it("reads integers, fractions and decimals exactly", () => {
    expect(rShow(parseRational("0.75")!)).toBe("3/4");
    expect(rShow(parseRational("6/8")!)).toBe("3/4");
    expect(rShow(parseRational("−12")!)).toBe("-12");
    expect(rShow(parseRational("1,250")!)).toBe("1250");
    expect(parseRational("about 3")).toBeNull();
    expect(parseRational("3/0")).toBeNull();
  });
});

describe("answer checking", () => {
  const numeric = getCard("nt.divisibility.a2")!;
  it("accepts equivalent forms and names a known slip", () => {
    expect(check(numeric, { kind: "numeric", text: "34" }).status).toBe("correct");
    expect(check(numeric, { kind: "numeric", text: "68/2" }).status).toBe("correct");
    const slip = check(numeric, { kind: "numeric", text: "33" });
    expect(slip.status).toBe("incorrect");
    expect(slip.message).toMatch(/off by one/);
  });
  it("does not count unreadable input as an attempt", () => {
    expect(check(numeric, { kind: "numeric", text: "thirty" }).status).toBe("invalid");
    expect(check(numeric, { kind: "numeric", text: "" }).status).toBe("invalid");
  });
  it("compares expressions symbolically and insists on complete factoring", () => {
    const card = getCard("alg.factoring.v1")!;
    expect(check(card, { kind: "expression", text: "3x(x+2)(x-2)" }).status).toBe("correct");
    expect(check(card, { kind: "expression", text: "(x - 2) · 3x · (x + 2)" }).status).toBe("correct");
    const partial = check(card, { kind: "expression", text: "3x(x^2-4)" });
    expect(partial.status).toBe("incorrect");
    expect(partial.message).toMatch(/still factors/);
    expect(check(card, { kind: "expression", text: "3x^3-12x" }).message).toMatch(/still a sum/);
    expect(check(card, { kind: "expression", text: "3x(x-2)(x+3)" }).status).toBe("incorrect");
    expect(check(card, { kind: "expression", text: "3y(y-2)(y+2)" }).status).toBe("invalid");
    expect(unfactored(parseExpr("(x+1)(x+2)"))).toBeNull();
    expect(unfactored(parseExpr("2(2x+4)"))).toMatch(/common numeric factor/);
  });
  it("gives option-specific reasoning for a wrong choice", () => {
    const card = getCard("alg.vieta.r1")!;
    const r = check(card, { kind: "choice", id: "solve" });
    expect(r.status).toBe("incorrect");
    expect(r.message).toMatch(/√29|square roots/);
  });
  it("marks an explanation by the points the student says they covered", () => {
    const card = getCard("geo.similar.e1")!;
    expect(check(card, { kind: "explain", text: "short", covered: [0, 1, 2] }).status).toBe("invalid");
    const full = check(card, { kind: "explain", text: "Vertical angles and alternate angles give AA.", covered: [0, 1, 2] });
    expect(full).toMatchObject({ status: "correct", selfReported: true });
    expect(check(card, { kind: "explain", text: "Vertical angles at E are equal.", covered: [0] }).status).toBe("incorrect");
  });
  it("checks ordering and blanks part by part", () => {
    const order = getCard("nt.primes.t2")!;
    expect(check(order, { kind: "order", ids: ["factor", "odd", "fix", "check"] }).status).toBe("correct");
    expect(check(order, { kind: "order", ids: ["odd", "factor", "fix", "check"] }).status).toBe("incorrect");
    const blanks = getCard("nt.primes.t1")!;
    const r = check(blanks, { kind: "blanks", values: ["3", "2", "6"] });
    expect(r.parts).toEqual([true, true, false]);
    expect(r.message).toMatch(/Add 1 to each exponent/);
  });
});

describe("card markup", () => {
  it("parses math and flattens it for plain text", () => {
    expect(plainText("Find $\\frac{1}{r} + \\frac{1}{s}$")).toBe("Find 1/r + 1/s");
    expect(plainText("$x^2 - 6x$")).toBe("x^(2) − 6x".replace("^(2)", "^2"));
    expect(() => parseRich("bad $\\frak{1}$")).toThrow(MarkupError);
    expect(() => parseRich("unbalanced $x")).toThrow(MarkupError);
  });
});

describe("card validation", () => {
  const base = getCard("nt.remainders.a1")!;
  const variant = (patch: Partial<Card>): Card => ({ ...structuredClone(base), ...patch });
  it("catches a wrong answer key against the independent verifier", () => {
    const wrong = variant({ interaction: { kind: "numeric", answer: "5" } });
    expect(validateCard(wrong, VERIFIERS[base.id]).join()).toMatch(/≠ independent result 6/);
  });
  it("catches an explanation that disagrees with the key", () => {
    const off = variant({ explanation: { summary: "The factors behave like 1, 2 and 3, so the remainder is 7." } });
    expect(validateCard(off, VERIFIERS[base.id]).join()).toMatch(/never states the answer 6/);
  });
  it("catches multiple choice on an application card, missing feedback and contest names", () => {
    const mc = variant({ interaction: { kind: "choice", answer: "a", options: [{ id: "a", text: "6" }, { id: "b", text: "3", feedback: "no" }] } });
    expect(validateCard(mc).join()).toMatch(/must ask for the answer itself/);
    const named = variant({ prompt: "From the 2019 AMC 10A: what is the remainder?" });
    expect(validateCard(named, VERIFIERS[base.id]).join()).toMatch(/real contest/);
    const terse = variant({ feedback: { correct: "Correct, well done.", incorrect: "Wrong." } });
    expect(validateCard(terse, VERIFIERS[base.id]).join()).toMatch(/must explain the reasoning/);
  });
  it("rejects a numeric card with no independent check", () => {
    expect(validateCard(base).join()).toMatch(/no independent verifier/);
  });
  it("covers every concept with all five card types and has no default to multiple choice", () => {
    const concepts = new Set(CARDS.map((c) => c.conceptId));
    expect(concepts.size).toBeGreaterThanOrEqual(12);
    for (const id of concepts) expect(new Set(cardsOf(id).map((c) => c.type)).size).toBe(5);
    const kinds = CARDS.map((c) => c.interaction.kind);
    expect(kinds.filter((k) => k === "numeric" || k === "expression" || k === "blanks").length / kinds.length).toBeGreaterThan(0.5);
    for (const c of CARDS.filter((x) => x.type === "application" || x.type === "variation")) expect(["numeric", "expression", "blanks", "tap"]).toContain(c.interaction.kind);
  });
  it("rebuilds generated variants deterministically from their ids", () => {
    for (const f of FAMILIES) {
      const a = f.make(7);
      expect(getCard(a.id)).toEqual(a);
      expect(familyOf(a.id)).toBe(f.id);
    }
    expect(getCard("nt.cycles.f-power~abc")).toBeUndefined();
    expect(getCard("no.such.card")).toBeUndefined();
  });
});

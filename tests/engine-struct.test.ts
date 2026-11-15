import { describe, expect, it } from "vitest";
import { getCard } from "@/lib/engine/registry";
import { applyStructMove, checkStructure, structValue, type StructCard, type StructState, type Term } from "@/lib/engine/struct/module";

const card = (id: string) => getCard(id) as StructCard;
const part = (slots: string[], sign: 1 | -1 = 1, div: string | null = null): Term => ({ sign, slots, div });
const check = (id: string, ...terms: Term[]) => checkStructure(card(id), { terms });
const fail = (id: string, ...terms: Term[]) => {
  const r = check(id, ...terms);
  if (r.ok) throw new Error("expected a mismatch");
  return `${r.reason} ${r.detail.join(" ")}`;
};

describe("Module B verifier: correct structures", () => {
  it("multiplication with shrinking slots", () => {
    expect(check("count.arrange.w", part(["fresh", "fresh", "fresh"])).ok).toBe(true);
    expect(structValue(card("count.arrange.w"), { terms: [part(["fresh", "fresh", "fresh"])] })).toBe(60);
  });
  it("divide by symmetry", () => {
    expect(check("count.committee.r2", part(["fresh", "fresh", "fresh"], 1, "kfact")).ok).toBe(true);
  });
  it("complement", () => {
    expect(check("count.complement.w", part(["any", "any", "any"]), part(["notSpecial", "notSpecial", "notSpecial"], -1)).ok).toBe(true);
  });
  it("a different but valid structure also passes: cases by where the first 7 is", () => {
    const r = check(
      "count.complement.w",
      part(["special", "any", "any"]),
      part(["notSpecial", "special", "any"]),
      part(["notSpecial", "notSpecial", "special"]),
    );
    expect(r.ok).toBe(true);
  });
});

describe("Module B verifier: wrong structures come with a concrete counterexample", () => {
  it("forgetting that order doesn't matter counts each group twice", () => {
    const msg = fail("count.committee.w", part(["fresh", "fresh"]));
    expect(msg).toMatch(/counted more than once/);
    expect(msg).toMatch(/\{A, B\} is counted 2 times: as A → B\s+and as\s+B → A/);
  });
  it("letting an item repeat counts something that isn't allowed", () => {
    const msg = fail("count.arrange.w", part(["any", "any", "any"]));
    expect(msg).toMatch(/isn't allowed/);
    expect(msg).toMatch(/it counts "AAA"/);
  });
  it("overlapping cases count the same code in two cases", () => {
    const msg = fail("count.complement.w", part(["special", "any", "any"]), part(["any", "special", "any"]), part(["any", "any", "special"]));
    expect(msg).toMatch(/"777" is counted 3 times: in part 1 and again in part 2/);
  });
  it("dividing by too much: only the interchangeable part is symmetric", () => {
    const msg = fail("count.committee.t", part(["leader", "fresh", "fresh"], 1, "allfact"));
    expect(msg).toMatch(/Dividing by 6 assumes every outcome was built exactly that many times/);
    expect(msg).toMatch(/was built 2 times, not 6/);
  });
  it("not dividing at all in the captain problem", () => {
    expect(fail("count.committee.t", part(["leader", "fresh", "fresh"]))).toMatch(/captain A with \{B, C\} is counted 2 times/);
  });
  it("too few slots misses outcomes; the right number with a wrong value is caught on the small version", () => {
    expect(fail("count.arrange.w", part(["fresh", "fresh"]))).toMatch(/isn't allowed|never counted/);
    expect(fail("count.arrange.r2", part(["fresh", "fresh", "fresh"]))).toMatch(/doesn't always have the same number of options|never counted/);
  });
  it("subtracting the wrong thing", () => {
    const msg = fail("count.complement.w", part(["any", "any", "any"]), part(["special", "special", "special"], -1));
    expect(msg).toMatch(/isn't allowed.*"888"|"777" is missed/);
  });
  it("gluing a pair but forgetting its two orders", () => {
    expect(fail("count.arrange.t", part(["block"]))).toMatch(/unfinished row/);
    expect(fail("count.arrange.t", part(["all"]))).toMatch(/isn't allowed.*the row/);
    expect(fail("count.arrange.t", part(["all"], 1, "two"))).toMatch(/built 1 time, not 2/);
  });
  it("a slot whose option count depends on earlier choices", () => {
    const msg = fail("count.complement.t", part(["any", "any", "fresh", "fresh"]));
    expect(msg).toMatch(/doesn't always have the same number of options/);
  });
  it("an empty part is refused", () => {
    expect(fail("count.arrange.w")).toMatch(/at least one slot/);
  });
});

describe("Module B moves", () => {
  it("builds a structure move by move and only ends on check", () => {
    const c = card("count.committee.w");
    let s: StructState = { terms: [] };
    for (const [move, params] of [["slot", { slot: "fresh" }], ["slot", { slot: "fresh" }], ["divide", { div: "kfact" }]] as const) {
      const r = applyStructMove(c, s, move, params);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.done).toBeFalsy();
        s = r.state;
      }
    }
    const done = applyStructMove(c, s, "check");
    expect(done.ok && done.done).toBe(true);
    expect(applyStructMove(c, { terms: [] }, "case").ok).toBe(false);
    expect(applyStructMove(c, s, "slot", { slot: "leader" }).ok).toBe(false); // not on this card's palette
  });
});

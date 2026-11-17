import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/dates";
import { cardsOf, familyOf, getCard } from "@/lib/learn/cards";
import { snapshots, grade } from "@/lib/learn/mastery";
import { scheduleOf, LADDER } from "@/lib/learn/review";
import { buildDaily, ensureDaily, nextExtra, nextInConcept, planRoles } from "@/lib/learn/select";
import { emptyLearnState, type LearnState } from "@/lib/learn/state";
import { DAY0, answer, playDay } from "./helpers";

const C = "nt.remainders";
const ids = (concept: string, type: string) => cardsOf(concept).filter((c) => c.type === type).map((c) => c.id);
const stateOf = (s: LearnState, id = C) => snapshots(s.events).get(id)!.state;

/** Teaching + recognition + the hand-written applications and variation, all clean, on one day. */
function learnAll(s: LearnState, concept: string, day: string): LearnState {
  for (const t of ["insight", "technique", "recognition", "application", "variation"]) for (const id of ids(concept, t)) s = answer(s, id, day);
  return s;
}

describe("initial availability", () => {
  it("unlocks only concepts whose required prerequisites are established", () => {
    const snaps = snapshots([]);
    expect(snaps.get("nt.divisibility")!.state).toBe("available");
    expect(snaps.get("alg.factoring")!.state).toBe("available");
    expect(snaps.get("nt.remainders")!.state).toBe("locked");
    expect(snaps.get("nt.remainders")!.blockedBy).toEqual(["nt.divisibility"]);
    expect(snaps.get("nt.cycles")!.state).toBe("locked");
    // A required prerequisite with no cards yet can never block.
    expect(snaps.get("alg.systems")!.state).toBe("available");
  });

  it("opens a concept once its prerequisite reaches Developing, not before", () => {
    let s = emptyLearnState();
    s = answer(s, "nt.divisibility.i1", DAY0, { correct: false });
    expect(snapshots(s.events).get("nt.remainders")!.state).toBe("locked");
    s = answer(s, "nt.divisibility.t1", DAY0);
    expect(stateOf(s, "nt.divisibility")).toBe("developing");
    expect(snapshots(s.events).get("nt.remainders")!.state).toBe("available");
  });
});

describe("concept state transitions", () => {
  it("climbs only on evidence of the right kind", () => {
    let s = emptyLearnState();
    s = answer(s, "nt.divisibility.t1", DAY0);
    s = answer(s, `${C}.i1`, DAY0, { correct: false });
    expect(stateOf(s)).toBe("introduced");
    s = answer(s, `${C}.t1`, DAY0);
    expect(stateOf(s)).toBe("developing");
    s = answer(s, `${C}.a1`, DAY0);
    expect(stateOf(s)).toBe("practicing");
    s = answer(s, `${C}.a2`, DAY0);
    s = answer(s, `${C}.r1`, DAY0);
    expect(stateOf(s)).toBe("practicing"); // no transfer yet
    s = answer(s, `${C}.v1`, DAY0);
    expect(stateOf(s)).toBe("proficient");
  });

  it("does not award mastery for completing lots of cards in one sitting", () => {
    let s = answer(emptyLearnState(), "nt.divisibility.t1", DAY0);
    s = learnAll(s, C, DAY0);
    for (let seed = 1; seed <= 6; seed++) s = answer(s, `${C}.f-product~${seed}`, DAY0);
    expect(stateOf(s)).toBe("proficient");
    expect(snapshots(s.events).get(C)!.next).toMatch(/after a few days/);
  });

  it("needs retention after real gaps for mastery", () => {
    let s = answer(emptyLearnState(), "nt.divisibility.t1", DAY0);
    s = learnAll(s, C, DAY0);
    s = answer(s, `${C}.f-product~1`, addDays(DAY0, 4));
    expect(stateOf(s)).toBe("proficient"); // one spaced success is not enough
    s = answer(s, `${C}.f-product~2`, addDays(DAY0, 6)); // second, but neither after a week
    expect(stateOf(s)).toBe("proficient");
    s = answer(s, `${C}.f-product~3`, addDays(DAY0, 14));
    expect(stateOf(s)).toBe("mastered");
  });

  it("gives no credit for hints, second attempts, self-reports or recently seen problems", () => {
    let s = answer(emptyLearnState(), "nt.divisibility.t1", DAY0);
    s = answer(s, `${C}.t1`, DAY0);
    s = answer(s, `${C}.a1`, DAY0, { hint: true });
    s = answer(s, `${C}.a2`, DAY0, { attempts: 2 });
    expect(stateOf(s)).toBe("developing");
    const e = s.events.at(-1)!;
    expect(grade(e)).toBe("assisted");
    // The same problem again a few days later is recall, not fresh evidence.
    let r = answer(s, `${C}.a1`, addDays(DAY0, 3));
    expect(r.events.at(-1)!.repeat).toBe(true);
    expect(stateOf(r)).toBe("developing");
    r = answer(s, `${C}.a1`, addDays(DAY0, 20));
    expect(r.events.at(-1)!.repeat).toBe(false);
    expect(stateOf(r)).toBe("practicing");
  });

  it("detects weakness and drops back to Developing until a clean success returns", () => {
    let s = answer(emptyLearnState(), "nt.divisibility.t1", DAY0);
    s = learnAll(s, C, DAY0);
    s = answer(s, `${C}.f-product~1`, addDays(DAY0, 2), { correct: false });
    expect(stateOf(s)).toBe("proficient"); // one slip is not a pattern
    s = answer(s, `${C}.f-product~2`, addDays(DAY0, 2), { correct: false });
    const snap = snapshots(s.events).get(C)!;
    expect(snap.state).toBe("developing");
    expect(snap.needsReinforcement).toBe(true);
    expect(snap.weakObjectives).toContain(`${C}/combine`);
    s = answer(s, `${C}.f-product~3`, addDays(DAY0, 3));
    expect(stateOf(s)).toBe("proficient");
  });

  it("can recognise a correct answer may be a guess: a skipped answer is never a pass", () => {
    let s = answer(emptyLearnState(), "nt.divisibility.t1", DAY0);
    s = answer(s, `${C}.t1`, DAY0);
    s = answer(s, `${C}.a1`, DAY0, { skip: true });
    expect(stateOf(s)).toBe("developing");
    expect(s.misses.at(-1)).toMatchObject({ outcome: "skipped", conceptId: C });
  });
});

describe("review scheduling", () => {
  it("lengthens intervals with spaced success, ignores cramming and resets after a miss", () => {
    let s = emptyLearnState();
    s = answer(s, "nt.divisibility.t1", DAY0);
    expect(scheduleOf(s.events)).toMatchObject({ step: 0, due: addDays(DAY0, 1) });
    s = answer(s, "nt.divisibility.a1", DAY0); // same day: too soon to count as spacing
    expect(scheduleOf(s.events)).toMatchObject({ step: 0, due: addDays(DAY0, 1) });
    let d = addDays(DAY0, 1);
    s = answer(s, "nt.divisibility.a2", d);
    expect(scheduleOf(s.events)).toMatchObject({ step: 1, due: addDays(d, LADDER[1]) });
    d = addDays(d, 3);
    s = answer(s, "nt.divisibility.r1", d);
    expect(scheduleOf(s.events)).toMatchObject({ step: 2, due: addDays(d, LADDER[2]) });
    d = addDays(d, 7);
    s = answer(s, "nt.divisibility.v1", d, { correct: false });
    expect(scheduleOf(s.events)).toMatchObject({ step: 0, due: addDays(d, 1), lapses: 1 });
  });
});

describe("daily selection", () => {
  it("starts a brand-new student on one concept, teaching first, with no locked concepts", () => {
    const plan = buildDaily(emptyLearnState(), DAY0);
    expect(plan.slots).toHaveLength(3);
    const cards = plan.slots.map((s) => getCard(s.cardId)!);
    expect(new Set(cards.map((c) => c.conceptId)).size).toBe(1);
    expect(["insight", "technique"]).toContain(cards[0].type);
    expect(snapshots([]).get(cards[0].conceptId)!.state).toBe("available");
  });

  it("is built once per day and is stable while it is being worked through", () => {
    const s = ensureDaily(emptyLearnState(), DAY0);
    expect(ensureDaily(s, DAY0)).toBe(s);
    expect(ensureDaily(s, addDays(DAY0, 1)).daily!.date).toBe(addDays(DAY0, 1));
  });

  it("gives the default Discover / Reinforce / Apply day once there is something to work with", () => {
    let s = emptyLearnState();
    for (let i = 0; i < 4; i++) s = playDay(s, addDays(DAY0, i));
    expect(planRoles(s, addDays(DAY0, 4))).toEqual(["discover", "reinforce", "apply"]);
  });

  it("switches to reinforcement when several concepts are slipping and adds no new material", () => {
    let s = emptyLearnState();
    for (let i = 0; i < 8; i++) s = playDay(s, addDays(DAY0, i));
    const seen = [...snapshots(s.events).values()].filter((x) => x.seen).map((x) => x.conceptId);
    expect(seen.length).toBeGreaterThanOrEqual(2);
    const day = addDays(DAY0, 9);
    for (const concept of seen.slice(0, 2)) {
      const apps = cardsOf(concept).filter((c) => c.type === "application" || c.type === "recognition" || c.type === "variation");
      for (const c of apps.slice(0, 2)) s = answer(s, c.id, day, { correct: false });
    }
    expect([...snapshots(s.events).values()].filter((x) => x.needsReinforcement).length).toBeGreaterThanOrEqual(2);
    const next = addDays(day, 1);
    expect(planRoles(s, next)).toEqual(["reinforce", "reinforce", "apply"]);
    const plan = buildDaily(s, next);
    const before = new Set(seen);
    for (const slot of plan.slots) expect(before.has(slot.conceptId)).toBe(true);
    expect(plan.slots.some((x) => snapshots(s.events).get(x.conceptId)!.needsReinforcement)).toBe(true);
  });

  it("never repeats a card or problem family within a day, and avoids recently seen problems", () => {
    let s = emptyLearnState();
    for (let i = 0; i < 25; i++) {
      const day = addDays(DAY0, i);
      s = ensureDaily(s, day);
      const fams = s.daily!.slots.map((x) => familyOf(x.cardId));
      expect(new Set(fams).size).toBe(fams.length);
      const recent = new Set(s.events.filter((e) => e.date > addDays(day, -7)).map((e) => e.cardId));
      for (const slot of s.daily!.slots) expect(recent.has(slot.cardId)).toBe(false);
      s = playDay(s, day, (id) => (id.length + i) % 5 !== 0);
    }
  });

  it("does not keep choosing the easiest cards: difficulty rises as evidence comes in", () => {
    let s = emptyLearnState();
    for (let i = 0; i < 30; i++) s = playDay(s, addDays(DAY0, i));
    const by = (from: number, to: number) => s.events.slice(from, to).map((e) => getCard(e.cardId)!.difficulty);
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(avg(by(-30, undefined as unknown as number))).toBeGreaterThan(avg(by(0, 15)));
    expect(s.events.slice(-30).some((e) => getCard(e.cardId)!.type === "variation")).toBe(true);
  });

  it("offers more after the daily three, and a per-concept path", () => {
    const s = playDay(emptyLearnState(), DAY0);
    const extra = nextExtra(s, DAY0)!;
    expect(extra).toBeTruthy();
    expect(s.daily!.slots.map((x) => x.cardId)).not.toContain(extra.cardId);
    const inConcept = nextInConcept(s, "cp.multiplication", DAY0)!;
    expect(getCard(inConcept.cardId)!.conceptId).toBe("cp.multiplication");
    expect(nextInConcept(s, "alg.functions", DAY0)).toBeNull(); // no cards written yet
  });
});

import { describe, expect, it } from "vitest";
import { pacing, timeBudget, RESURFACE_DAYS } from "@/lib/engine/config";
import {
  availability, buildDailySet, dailyStatus, emptyProgress, ensureDailySet, isEngineProgress, markExampleSeen, minutesOn, nextLessonStep,
  quickSteps, recordCard, setMistakeDetails, skillState, type CardOutcome, type EngineProgress, type Step,
} from "@/lib/engine/progress";
import { ALL_SKILLS, getCard, moduleOf, skillOf } from "@/lib/engine/registry";
import { checkCard } from "@/lib/engine/verify-cards";
import type { ExprCard } from "@/lib/engine/expr/module";
import type { StructCard } from "@/lib/engine/struct/module";
import { addDays } from "@/lib/dates";

const D1 = "2027-01-04";
const PACE = pacing(D1, null);

function outcome(step: Step, over: Partial<CardOutcome> = {}): CardOutcome {
  const card = getCard(step.cardId)!;
  return {
    cardId: step.cardId, source: step.source, level: step.level, seconds: 20, wrongMoves: 0, hintLevel: 0, outcome: "solved",
    skippedKeyMove: false, problem: card.prompt, userAnswer: "…", correctAnswer: moduleOf(card).answer(card), queueId: step.queueId, ...over,
  };
}
/** Work a skill's lesson until `stop` cards have been passed (default: through the twist). */
function learn(p: EngineProgress, skillId: string, day: string, stop = 4): EngineProgress {
  p = markExampleSeen(p, skillId, day);
  for (let i = 0; i < stop; i++) {
    const step = nextLessonStep(p, skillId, PACE)!;
    p = recordCard(p, outcome(step), day).progress;
  }
  return p;
}

describe("lesson and mastery", () => {
  it("worked example, three easy reps, then the twist; mastery needs the twist", () => {
    let p = emptyProgress();
    const first = nextLessonStep(p, "quad.gcf", PACE)!;
    expect(first).toMatchObject({ cardId: "quad.gcf.r1", type: "rep", level: 1, example: true });
    p = markExampleSeen(p, "quad.gcf", D1);
    for (const id of ["quad.gcf.r1", "quad.gcf.r2", "quad.gcf.r3"]) {
      const step = nextLessonStep(p, "quad.gcf", PACE)!;
      expect(step.cardId).toBe(id);
      expect(step.example).toBe(false);
      p = recordCard(p, outcome(step), D1).progress;
    }
    expect(skillState(p, "quad.gcf").stage).toBe("twist"); // reps done, NOT mastered
    const twist = nextLessonStep(p, "quad.gcf", PACE)!;
    expect(twist).toMatchObject({ cardId: "quad.gcf.t", type: "twist" });
    const r = recordCard(p, outcome(twist), D1);
    expect(r.events).toContain("mastered");
    expect(skillState(r.progress, "quad.gcf").stage).toBe("mastered");
    expect(nextLessonStep(r.progress, "quad.gcf", PACE)).toBeNull();
  });

  it("a hint means no mastery credit, and the idea is queued to come back", () => {
    let p = learn(emptyProgress(), "quad.gcf", D1, 3);
    const twist = nextLessonStep(p, "quad.gcf", PACE)!;
    const r = recordCard(p, outcome(twist, { hintLevel: 1 }), D1);
    p = r.progress;
    expect(r.result).toBe("assisted");
    expect(r.mistakeId).toBeNull(); // solved, so not a mistake
    expect(skillState(p, "quad.gcf").stage).toBe("twist");
    expect(p.queue).toMatchObject([{ skill: "quad.gcf", kind: "twist", stage: 0, due: addDays(D1, 1), status: "pending" }]);
    // The retry is a fresh variant, never the same twist.
    const retry = nextLessonStep(p, "quad.gcf", PACE)!;
    expect(retry.cardId).not.toBe("quad.gcf.t");
    expect(getCard(retry.cardId)).toMatchObject({ type: "twist", generated: true });
  });

  it("too many wrong moves also forfeits credit", () => {
    const p = markExampleSeen(emptyProgress(), "quad.gcf", D1);
    const r = recordCard(p, outcome(nextLessonStep(p, "quad.gcf", PACE)!, { wrongMoves: 3 }), D1);
    expect(r.result).toBe("assisted");
    expect(skillState(r.progress, "quad.gcf").reps).toBe(0);
  });

  it("prerequisites lock later skills until the easy reps are done", () => {
    let p = emptyProgress();
    const dos = skillOf("quad.dos")!;
    expect(availability(p, dos, D1)).toBe("locked");
    p = learn(p, "quad.gcf", D1, 2);
    expect(availability(p, dos, D1)).toBe("locked");
    p = learn(p, "quad.gcf", D1, 1);
    expect(availability(p, dos, D1)).toBe("open");
  });
});

describe("mistakes, resurfacing and wheel-spinning", () => {
  it("a miss is logged with everything the error log needs", () => {
    let p = markExampleSeen(emptyProgress(), "quad.tri", D1);
    const step = nextLessonStep(p, "quad.tri", PACE)!;
    const r = recordCard(p, outcome(step, { outcome: "not_sure", seconds: 12.4, userAnswer: "x² + 7x + 12" }), D1);
    p = r.progress;
    expect(p.mistakes).toHaveLength(1);
    expect(p.mistakes[0]).toMatchObject({
      id: r.mistakeId, date: D1, cardId: "quad.tri.r1", skill: "quad.tri", topic: "algebra", problem: "Factor completely.",
      userAnswer: "x² + 7x + 12", correctAnswer: "(x − 2)(x − 3)", seconds: 12, outcome: "not_sure", errorType: null, note: "",
    });
    p = setMistakeDetails(p, r.mistakeId!, "no_approach", "  forgot to list factor pairs ");
    expect(p.mistakes[0]).toMatchObject({ errorType: "no_approach", note: "forgot to list factor pairs" });
    // A timeout pre-selects "ran out of time".
    const t = recordCard(p, outcome(nextLessonStep(p, "quad.tri", PACE)!, { outcome: "timeout" }), D1);
    expect(t.progress.mistakes[1].errorType).toBe("out_of_time");
  });

  it("logs topic, skill, level, time, wrong moves, hint level and result for every card", () => {
    const p = markExampleSeen(emptyProgress(), "count.arrange", D1);
    const r = recordCard(p, outcome(nextLessonStep(p, "count.arrange", PACE)!, { seconds: 41, wrongMoves: 1, hintLevel: 2 }), D1);
    expect(r.progress.logs[0]).toMatchObject({
      date: D1, cardId: "count.arrange.r1", topic: "counting_probability", skill: "count.arrange", type: "rep", source: "lesson",
      level: 1, seconds: 41, wrongMoves: 1, hintLevel: 2, result: "assisted",
    });
  });

  it("a missed idea returns as a fresh variant after 1, 3 and 7 days, then retires", () => {
    expect([...RESURFACE_DAYS]).toEqual([1, 3, 7]);
    let p = markExampleSeen(emptyProgress(), "quad.gcf", D1);
    const missed = nextLessonStep(p, "quad.gcf", PACE)!;
    p = recordCard(p, outcome(missed, { outcome: "timeout" }), D1).progress;
    let day = D1;
    for (const gap of [1, 3, 7]) {
      // Not due yet the day before.
      expect(buildDailySet(p, addDays(day, gap - 1), PACE).slots.some((s) => s.queueId)).toBe(false);
      day = addDays(day, gap);
      const review = buildDailySet(p, day, PACE).slots.find((s) => s.kind === "review")!;
      expect(review.queueId).toBe(p.queue[0].id);
      expect(review.cardId).not.toBe(missed.cardId);
      expect(getCard(review.cardId)!.generated).toBe(true);
      p = ensureDailySet(p, day, PACE);
      p = recordCard(p, outcome(review), day).progress;
    }
    expect(p.queue[0].status).toBe("retired");
    const ids = p.logs.map((l) => l.cardId);
    expect(new Set(ids).size).toBe(ids.length); // never the same problem twice
  });

  it("missing a resurfaced variant sends it back to 1 day", () => {
    let p = markExampleSeen(emptyProgress(), "quad.gcf", D1);
    p = recordCard(p, outcome(nextLessonStep(p, "quad.gcf", PACE)!, { outcome: "not_sure" }), D1).progress;
    const d2 = addDays(D1, 1);
    p = ensureDailySet(p, d2, PACE);
    const review = p.daily!.slots.find((s) => s.kind === "review")!;
    p = recordCard(p, outcome(review), d2).progress;
    expect(p.queue[0]).toMatchObject({ stage: 1, due: addDays(d2, 3) });
    const d5 = addDays(d2, 3);
    p = ensureDailySet(p, d5, PACE);
    p = recordCard(p, outcome(p.daily!.slots.find((s) => s.kind === "review")!, { outcome: "timeout" }), d5).progress;
    expect(p.queue[0]).toMatchObject({ stage: 0, due: addDays(d5, 1), status: "pending" });
    expect(p.queue).toHaveLength(1); // one pending item per skill
  });

  it("three misses in a row: re-show the worked example, park the skill, move on, return later", () => {
    let p = learn(emptyProgress(), "quad.gcf", D1, 3); // gcf reps done: dos and tri open up
    p = markExampleSeen(p, "quad.dos", D1);
    let events: string[] = [];
    for (let i = 0; i < 3; i++) {
      const r = recordCard(p, outcome(nextLessonStep(p, "quad.dos", PACE)!, { outcome: "not_sure" }), D1);
      p = r.progress;
      events = r.events;
    }
    expect(events).toContain("parked");
    expect(availability(p, skillOf("quad.dos")!, D1)).toBe("parked");
    expect(skillState(p, "quad.dos")).toMatchObject({ reshow: true, failures: 0 });
    // Today's "new concept" moves on to something else...
    const set = buildDailySet(p, addDays(D1, 1), PACE);
    expect(set.slots.every((s) => s.skill !== "quad.dos")).toBe(true);
    // ...and the skill returns later, worked example first.
    const later = addDays(D1, 2);
    expect(availability(p, skillOf("quad.dos")!, later)).toBe("open");
    expect(nextLessonStep(p, "quad.dos", PACE)!.example).toBe(true);
  });
});

describe("daily set", () => {
  it("day one is all new concept: the worked example and the easy reps", () => {
    const p = ensureDailySet(emptyProgress(), D1, PACE);
    const set = p.daily!;
    expect(set.slots.map((s) => s.kind)).toEqual(["new", "new", "new"]);
    expect(set.slots[0].example).toBe(true);
    expect(new Set(set.slots.map((s) => s.skill)).size).toBe(1);
    expect(dailyStatus(p, D1)).toEqual({ total: 3, done: 0, complete: false });
    expect(ensureDailySet(p, D1, PACE)).toBe(p); // built once per day
  });

  it("later: one review from the mistakes queue, one new concept, one stretch from the weakest topic", () => {
    let p = learn(emptyProgress(), "quad.gcf", D1, 3);
    p = learn(p, "count.arrange", D1, 3);
    // Make counting the weak topic, and leave a miss in the queue for algebra.
    p = recordCard(p, outcome(nextLessonStep(p, "count.arrange", PACE)!, { outcome: "timeout" }), D1).progress;
    p = recordCard(p, outcome(nextLessonStep(p, "count.arrange", PACE)!, { outcome: "timeout" }), D1).progress;
    p = recordCard(p, outcome(nextLessonStep(p, "quad.gcf", PACE)!, { outcome: "not_sure" }), D1).progress;
    const d2 = addDays(D1, 1);
    p = ensureDailySet(p, d2, PACE);
    const [review, fresh, stretch] = p.daily!.slots;
    expect([review.kind, fresh.kind, stretch.kind]).toEqual(["review", "new", "stretch"]);
    expect(review.queueId).toBeTruthy();
    expect(getCard(review.cardId)!.generated).toBe(true);
    expect(stretch.skill.startsWith("count.")).toBe(true); // weakest topic
    expect(stretch.type).toBe("twist");
    expect(new Set(p.daily!.slots.map((s) => s.cardId)).size).toBe(3);

    for (const slot of p.daily!.slots) p = recordCard(p, outcome(slot, { seconds: 30 }), d2).progress;
    expect(dailyStatus(p, d2)).toEqual({ total: 3, done: 3, complete: true });
    expect(minutesOn(p, d2)).toBe(1.5);
  });

  it("earlier skills are mixed back in when nothing is due (interleaving)", () => {
    let p = learn(emptyProgress(), "quad.gcf", D1, 4);
    p = learn(p, "quad.dos", D1, 1);
    const set = buildDailySet(p, addDays(D1, 1), PACE);
    const review = set.slots.find((s) => s.kind === "review")!;
    expect(review.skill).toBe("quad.gcf");
    expect(review.queueId).toBeUndefined();
    expect(set.slots.find((s) => s.kind === "new")!.skill).toBe("quad.dos");
  });

  it("every skill can be reached and mastered through daily sets alone", () => {
    let p = emptyProgress();
    let day = D1;
    for (let i = 0; i < 80 && ALL_SKILLS.some((s) => skillState(p, s.id).stage !== "mastered"); i++) {
      p = ensureDailySet(p, day, PACE);
      for (const slot of p.daily!.slots) {
        if (slot.example) p = markExampleSeen(p, slot.skill, day);
        expect(getCard(slot.cardId), slot.cardId).toBeTruthy();
        p = recordCard(p, outcome(slot), day).progress;
      }
      day = addDays(day, 1);
    }
    expect(ALL_SKILLS.filter((s) => skillState(p, s.id).stage !== "mastered").map((s) => s.id)).toEqual([]);
  });
});

describe("quick reps (the 90-second mode)", () => {
  it("only draws from ideas already worked in a lesson or daily set", () => {
    expect(quickSteps(emptyProgress(), D1, PACE)).toEqual([]);
    const p = learn(emptyProgress(), "quad.gcf", D1, 1);
    const steps = quickSteps(p, D1, PACE);
    expect(steps).toHaveLength(3);
    expect(steps.every((s) => s.skill === "quad.gcf" && s.type === "rep" && getCard(s.cardId)?.generated)).toBe(true);
    expect(new Set(steps.map((s) => s.cardId)).size).toBe(3);
  });
});

describe("pacing from the contest date", () => {
  it("is computed, never hardcoded", () => {
    expect(pacing(D1, null)).toMatchObject({ phase: "foundation", minLevel: 1, allowNew: true });
    expect(pacing(D1, addDays(D1, 90)).phase).toBe("foundation");
    expect(pacing(D1, addDays(D1, 40))).toMatchObject({ phase: "build", minLevel: 2 });
    expect(pacing(D1, addDays(D1, 14))).toMatchObject({ phase: "sharpen", budgetScale: 0.85 });
    expect(pacing(D1, addDays(D1, 5))).toMatchObject({ phase: "taper", allowNew: false });
    expect(pacing(D1, addDays(D1, -3)).phase).toBe("foundation");
  });
  it("tightens time budgets and raises scaffolding near the contest", () => {
    const rep = getCard("quad.gcf.r1")!;
    expect(timeBudget(rep, pacing(D1, null))).toBe(30);
    expect(timeBudget(rep, pacing(D1, addDays(D1, 14)))).toBe(26);
    expect(timeBudget(getCard("quad.gcf.t")!, pacing(D1, null))).toBe(60);
    const p = learn(emptyProgress(), "quad.gcf", D1, 1);
    expect(nextLessonStep(p, "quad.gcf", pacing(D1, null))!.level).toBe(1);
    expect(nextLessonStep(p, "quad.gcf", pacing(D1, addDays(D1, 40)))!.level).toBe(2);
  });
  it("in the last week no brand-new skill is introduced", () => {
    const taper = pacing(D1, addDays(D1, 5));
    expect(buildDailySet(emptyProgress(), D1, taper).slots).toEqual([]);
    const p = learn(emptyProgress(), "quad.gcf", D1, 4);
    const set = buildDailySet(p, addDays(D1, 1), taper);
    expect(set.slots.length).toBeGreaterThan(0);
    expect(set.slots.every((s) => s.skill === "quad.gcf")).toBe(true);
  });
});

describe("stored progress", () => {
  it("survives JSON and rejects foreign data", () => {
    const p = learn(emptyProgress(), "quad.gcf", D1, 2);
    expect(isEngineProgress(JSON.parse(JSON.stringify(p)))).toBe(true);
    expect(isEngineProgress({ v: 99 })).toBe(false);
    expect(isEngineProgress(null)).toBe(false);
  });
});

describe("the card verifier catches bad content", () => {
  const quad = getCard("quad.tri.r1") as ExprCard;
  const zero = getCard("quad.zero.r1") as ExprCard;
  const count = getCard("count.committee.r2") as StructCard;
  it("passes the shipped cards", () => {
    for (const c of [quad, zero, count]) expect(checkCard(c)).toEqual([]);
  });
  it("a wrong factoring key", () => {
    expect(checkCard({ ...quad, goal: { type: "factored", final: "(x-2)(x+3)" } }).join(" | ")).toMatch(/does not multiply out/);
  });
  it("a key that is not fully factored", () => {
    const c = getCard("quad.dos.t") as ExprCard;
    expect(checkCard({ ...c, goal: { type: "factored", final: "(x^2-9)(x^2+9)" }, path: c.path.slice(0, 1) }).join(" | ")).toMatch(/still factors/);
  });
  it("a missing or wrong solution", () => {
    expect(checkCard({ ...zero, goal: { type: "solved", solutions: ["2"] } }).join(" | ")).toMatch(/has 2 real solutions but the key lists 1/);
    expect(checkCard({ ...zero, goal: { type: "solved", solutions: ["5", "2"] } }).join(" | ")).toMatch(/5 does not satisfy/);
  });
  it("a reference path with a wrong step", () => {
    expect(checkCard({ ...quad, path: [{ move: "trinomial", params: { p: "2", q: "3" } }] }).join(" | ")).toMatch(/reference path: step 1/);
  });
  it("a wrong counting key, or a scaled-down version that changes the structure", () => {
    expect(checkCard({ ...count, answer: 210 }).join(" | ")).toMatch(/brute force of the full problem gives 35, key says 210/);
    expect(checkCard({ ...count, small: { ...count.small, k: 2 } }).join(" | ")).toMatch(/changes "k"/);
  });
  it("text that names a real contest", () => {
    expect(checkCard({ ...quad, prompt: "From the 2019 AMC 10A" }).join(" | ")).toMatch(/names a real contest/);
  });
});

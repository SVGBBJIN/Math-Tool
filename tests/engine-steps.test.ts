import { describe, expect, it } from "vitest";
import { isTimed, pacing } from "@/lib/engine/config";
import {
  availability, canTestOut, emptyProgress, finishTestOut, levelFor, markExampleSeen, nextLessonStep, recordCard, testOutSteps, type CardOutcome, type EngineProgress, type Step,
} from "@/lib/engine/progress";
import { getCard, moduleOf, skillOf } from "@/lib/engine/registry";
import { failedStep } from "@/lib/engine/ui";

const D1 = "2027-01-04";
const PACE = pacing(D1, null);
function outcome(step: Step, over: Partial<CardOutcome> = {}): CardOutcome {
  const card = getCard(step.cardId)!;
  return {
    cardId: step.cardId, source: step.source, level: step.level, seconds: 20, wrongMoves: 0, hintLevel: 0, outcome: "solved",
    skippedKeyMove: false, problem: card.prompt, userAnswer: "…", correctAnswer: moduleOf(card).answer(card), queueId: step.queueId, ...over,
  };
}
function toTwist(p: EngineProgress, skill: string): EngineProgress {
  p = markExampleSeen(p, skill, D1);
  for (let i = 0; i < 3; i++) p = recordCard(p, outcome(nextLessonStep(p, skill, PACE)!), D1).progress;
  return p;
}

describe("per-step logs", () => {
  it("every step is logged with topic, skill, level, time, wrong moves, hint level and result", () => {
    let p = markExampleSeen(emptyProgress(), "quad.zero", D1);
    const step = nextLessonStep(p, "quad.zero", PACE)!;
    p = recordCard(p, outcome(step, {
      steps: [
        { move: "trinomial", level: 1, seconds: 12.34, wrongMoves: 1, hintLevel: 0, result: "ok" },
        { move: "zero_product", level: 1, seconds: 4, wrongMoves: 0, hintLevel: 2, result: "ok" },
        { move: "solve_linear", level: 1, seconds: 3, wrongMoves: 0, hintLevel: 0, result: "ok" },
      ],
    }), D1).progress;
    expect(p.steps).toHaveLength(3);
    expect(p.steps![0]).toMatchObject({ topic: "algebra", skill: "quad.zero", level: 1, seconds: 12.3, wrongMoves: 1, hintLevel: 0, result: "ok", index: 0, cardId: step.cardId });
    expect(p.steps![1].hintLevel).toBe(2);
  });
  it("older saved progress without step logs still records", () => {
    const old = { ...emptyProgress() } as EngineProgress;
    delete old.steps;
    const p = markExampleSeen(old, "quad.gcf", D1);
    const r = recordCard(p, outcome(nextLessonStep(p, "quad.gcf", PACE)!, { steps: [{ move: "gcf", level: 1, seconds: 3, wrongMoves: 0, hintLevel: 0, result: "ok" }] }), D1);
    expect(r.progress.steps).toHaveLength(1);
  });
});

describe("mistakes record the failed step and the workspace", () => {
  it("a miss stores which step failed and every line on the workspace", () => {
    let p = markExampleSeen(emptyProgress(), "quad.zero", D1);
    const step = nextLessonStep(p, "quad.zero", PACE)!;
    const card = getCard(step.cardId)!;
    const mod = moduleOf(card);
    const s0 = mod.init(card);
    const r1 = mod.apply(card, s0, card.path[0]);
    if (!r1.ok) throw new Error(r1.reason);
    const line = mod.show(r1.state, card);
    const fs = failedStep(card, line, 1);
    expect(fs).toMatch(/^Step 2: Zero-product rule/);
    const r = recordCard(p, outcome(step, { outcome: "timeout", failedStep: fs, workspace: [mod.show(s0, card), line], userAnswer: line }), D1);
    p = r.progress;
    const m = p.mistakes.find((x) => x.id === r.mistakeId)!;
    expect(m.failedStep).toBe(fs);
    expect(m.workspace).toHaveLength(2);
    expect(m.errorType).toBe("out_of_time");
  });
  it("leaving the reference route is described as such", () => {
    const card = getCard("quad.zero.r3")!;
    expect(failedStep(card, "x² − 5x − 14 = 0  or  x = 99", 2)).toMatch(/Left the shortest route after step 2/);
  });
});

describe("support level moves with the student", () => {
  it("the level a card ended on is remembered for the skill", () => {
    let p = markExampleSeen(emptyProgress(), "quad.gcf", D1);
    p = recordCard(p, outcome(nextLessonStep(p, "quad.gcf", PACE)!, { endLevel: 3 }), D1).progress;
    expect(levelFor(p, "quad.gcf", "rep", "lesson", PACE)).toBe(3);
    p = recordCard(p, outcome(nextLessonStep(p, "quad.gcf", PACE)!, { level: 3, endLevel: 1 }), D1).progress;
    expect(levelFor(p, "quad.gcf", "rep", "lesson", PACE)).toBe(1);
  });
  it("a twist never starts guided", () => {
    let p = toTwist(emptyProgress(), "quad.gcf");
    p = { ...p, skills: { ...p.skills, "quad.gcf": { ...p.skills["quad.gcf"], level: 1 } } };
    expect(levelFor(p, "quad.gcf", "twist", "lesson", PACE)).toBe(2);
  });
  it("the dial overrides adaptation and isn't overwritten by it", () => {
    let p: EngineProgress = { ...markExampleSeen(emptyProgress(), "quad.gcf", D1), dial: 2 };
    p = recordCard(p, outcome(nextLessonStep(p, "quad.gcf", PACE)!, { endLevel: 3 }), D1).progress;
    expect(levelFor(p, "quad.gcf", "rep", "lesson", PACE)).toBe(2);
    expect(p.skills["quad.gcf"].level).toBeUndefined();
  });
});

describe("mastery needs the twist at Level 2 or 3 without hints", () => {
  it("a clean twist at Level 2 masters the skill", () => {
    let p = toTwist(emptyProgress(), "quad.gcf");
    const step = nextLessonStep(p, "quad.gcf", PACE)!;
    expect(step.type).toBe("twist");
    const r = recordCard(p, outcome(step, { level: 2, endLevel: 2 }), D1);
    p = r.progress;
    expect(r.result).toBe("pass");
    expect(p.skills["quad.gcf"].stage).toBe("mastered");
  });
  it("a twist that dropped to Level 1 mid-card earns no mastery", () => {
    const p = toTwist(emptyProgress(), "quad.gcf");
    const r = recordCard(p, outcome(nextLessonStep(p, "quad.gcf", PACE)!, { level: 2, endLevel: 1 }), D1);
    expect(r.result).toBe("assisted");
    expect(r.progress.skills["quad.gcf"].stage).toBe("twist");
  });
});

describe("timing", () => {
  it("micro-session cards (quick reps, daily set) are timed; lessons are not", () => {
    for (const s of ["quick", "review", "new", "stretch"]) expect(isTimed(s)).toBe(true);
    expect(isTimed("lesson")).toBe(false);
  });
});

describe("skip a concept by testing out", () => {
  it("a test is a fresh easy rep and a fresh twist at Level 3, never a card already seen", () => {
    let p = markExampleSeen(emptyProgress(), "quad.gcf", D1);
    p = recordCard(p, outcome(nextLessonStep(p, "quad.gcf", PACE)!), D1).progress;
    const steps = testOutSteps(p, "quad.gcf");
    expect(steps.map((s) => [s.type, s.level, s.source])).toEqual([["rep", 3, "test"], ["twist", 3, "test"]]);
    expect(new Set(steps.map((s) => s.cardId)).size).toBe(2);
    for (const s of steps) expect(p.logs.some((l) => l.cardId === s.cardId)).toBe(false);
  });
  it("passing both cards marks the skill known and unlocks the next one", () => {
    let p = emptyProgress();
    expect(availability(p, skillOf("quad.dos")!, D1)).toBe("locked");
    for (const step of testOutSteps(p, "quad.gcf")) {
      const r = recordCard(p, outcome(step), D1);
      expect(r.result).toBe("pass");
      p = r.progress;
    }
    p = finishTestOut(p, "quad.gcf", true, D1);
    expect(p.skills["quad.gcf"]).toMatchObject({ stage: "mastered", testedOut: true, masteredOn: D1 });
    expect(availability(p, skillOf("quad.dos")!, D1)).toBe("open");
    expect(p.logs.filter((l) => l.source === "test")).toHaveLength(2);
  });
  it("a hint or a miss fails the test with no penalty: no mistake, no queue, no wheel-spin count, lesson still open", () => {
    let p = emptyProgress();
    const [rep] = testOutSteps(p, "quad.gcf");
    const hinted = recordCard(p, outcome(rep, { hintLevel: 1 }), D1);
    expect(hinted.result).toBe("assisted");
    const missed = recordCard(p, outcome(rep, { outcome: "not_sure" }), D1);
    expect(missed.mistakeId).toBeNull();
    p = finishTestOut(missed.progress, "quad.gcf", false, D1);
    expect(p.mistakes).toHaveLength(0);
    expect(p.queue).toHaveLength(0);
    expect(p.skills["quad.gcf"]).toMatchObject({ stage: "new", failures: 0, testedOn: D1 });
    expect(availability(p, skillOf("quad.gcf")!, D1)).toBe("open");
    expect(nextLessonStep(p, "quad.gcf", PACE)!.example).toBe(true);
  });
  it("one attempt per skill per day, and only on open skills", () => {
    let p = emptyProgress();
    expect(canTestOut(p, skillOf("quad.gcf")!, D1)).toBe(true);
    expect(canTestOut(p, skillOf("quad.dos")!, D1)).toBe(false); // locked
    p = finishTestOut(p, "quad.gcf", false, D1);
    expect(canTestOut(p, skillOf("quad.gcf")!, D1)).toBe(false);
    expect(canTestOut(p, skillOf("quad.gcf")!, "2027-01-05")).toBe(true);
    p = finishTestOut(p, "quad.gcf", true, "2027-01-05");
    expect(canTestOut(p, skillOf("quad.gcf")!, "2027-01-06")).toBe(false); // mastered
  });
  it("tests are untimed", () => {
    expect(isTimed("test")).toBe(false);
  });
});

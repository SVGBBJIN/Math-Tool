import { describe, expect, it } from "vitest";
import { isTimed, pacing } from "@/lib/engine/config";
import { emptyProgress, levelFor, markExampleSeen, nextLessonStep, recordCard, type CardOutcome, type EngineProgress, type Step } from "@/lib/engine/progress";
import { getCard, moduleOf } from "@/lib/engine/registry";
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

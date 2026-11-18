import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/dates";
import { parseDocument, toEnvelope } from "@/lib/learn/persistence";
import {
  PROBLEMS, baseOf, checkStep, ensureDailyProblem, getProblem, modeFor, ownedSteps, problemDayOf, recentDays, recordStep, REPEAT_GAP_DAYS,
  type Problem,
} from "@/lib/learn/problems";
import { validateProblem } from "@/lib/learn/problems/validate";
import { emptyLearnState, type LearnState } from "@/lib/learn/state";

const DAY0 = "2026-11-02";

/** Play a day's problem: answer every owned step correctly, first try. */
function solveDay(s: LearnState, date: string): LearnState {
  s = ensureDailyProblem(s, date);
  const day = problemDayOf(s, date)!;
  const p = getProblem(day.problemId)!;
  for (const k of ownedSteps(p, day.mode)) s = recordStep(s, date, k, { type: "attempt", correct: true });
  return s;
}

describe("validation catches bad problems", () => {
  const good = getProblem("p.alg.tickets")!;
  it("accepts a good one", () => expect(validateProblem(good)).toEqual([]));
  it("rejects a wrong step key", () => {
    const bad: Problem = { ...good, steps: good.steps.map((s, k) => (k === 0 ? { ...s, input: { kind: "numeric" as const, answer: "701" } } : s)) };
    expect(validateProblem(bad).join(" ")).toMatch(/verifier gets 700/);
  });
  it("rejects a wrong final answer and unordered choices", () => {
    const last = good.steps.length - 1;
    const bad: Problem = { ...good, steps: good.steps.map((s, k) => (k === last ? { ...s, input: { kind: "amc" as const, values: ["40", "50", "60", "80", "100"], answer: 1 } } : s)) };
    expect(validateProblem(bad).join(" ")).toMatch(/verifier gets 60/);
    const unordered: Problem = { ...good, steps: good.steps.map((s, k) => (k === last ? { ...s, input: { kind: "amc" as const, values: ["60", "50", "40", "80", "100"], answer: 0 } } : s)) };
    expect(validateProblem(unordered).join(" ")).toMatch(/increasing order/);
  });
  it("rejects a key step on the final step, and contest names", () => {
    expect(validateProblem({ ...good, part: good.steps.length - 1 }).join(" ")).toMatch(/key step/);
    expect(validateProblem({ ...good, statement: "From the 2019 AMC 10A:" + good.statement }).join(" ")).toMatch(/real contest/);
  });
});

describe("checking a step", () => {
  const p = getProblem("p.geo.similar")!;
  it("accepts equivalent numbers and explains known slips", () => {
    expect(checkStep(p.steps[0], { kind: "numeric", text: "4/10" }).status).toBe("correct");
    expect(checkStep(p.steps[0], { kind: "numeric", text: "0.4" }).status).toBe("correct");
    const slip = checkStep(p.steps[0], { kind: "numeric", text: "2/3" });
    expect(slip.status).toBe("incorrect");
    expect(slip.message).toMatch(/AD.*DB/);
    expect(checkStep(p.steps[0], { kind: "numeric", text: "abc" }).status).toBe("invalid");
  });
  it("checks the five-choice final step by position", () => {
    const fin = p.steps[p.steps.length - 1];
    if (fin.input.kind !== "amc") throw new Error("expected amc");
    expect(checkStep(fin, { kind: "amc", index: fin.input.answer }).status).toBe("correct");
    expect(checkStep(fin, { kind: "amc", index: (fin.input.answer + 1) % 5 }).status).toBe("incorrect");
  });
});

describe("the day's problem", () => {
  it("alternates full and part days", () => {
    expect(modeFor(DAY0)).not.toBe(modeFor(addDays(DAY0, 1)));
    expect(modeFor(DAY0)).toBe(modeFor(addDays(DAY0, 2)));
  });

  it("is stable within a day and changes across days", () => {
    const s = ensureDailyProblem(emptyLearnState(), DAY0);
    expect(ensureDailyProblem(s, DAY0)).toBe(s);
    const next = ensureDailyProblem(s, addDays(DAY0, 1));
    expect(problemDayOf(next, addDays(DAY0, 1))!.problemId).not.toBe(problemDayOf(s, DAY0)!.problemId);
  });

  it("rotates through every domain and never repeats a problem within the gap", () => {
    let s = emptyLearnState();
    for (let k = 0; k < 90; k++) s = solveDay(s, addDays(DAY0, k));
    const days = s.problemDays;
    expect(days).toHaveLength(90);
    // Any four consecutive days cover all four domains.
    for (let k = 0; k + 4 <= days.length; k++) {
      expect(new Set(days.slice(k, k + 4).map((d) => getProblem(d.problemId)!.domain)).size).toBe(4);
    }
    for (let k = 0; k < days.length; k++) {
      for (let j = Math.max(0, k - REPEAT_GAP_DAYS + 1); j < k; j++) expect(baseOf(days[j].problemId)).not.toBe(baseOf(days[k].problemId));
    }
    expect(REPEAT_GAP_DAYS).toBeGreaterThanOrEqual(16);
    // Every problem and family gets used.
    expect(new Set(days.map((d) => baseOf(d.problemId))).size).toBe(19);
  });
});

describe("recording", () => {
  const start = (mode: "full" | "part") => {
    // Find a date with the requested mode.
    const date = modeFor(DAY0) === mode ? DAY0 : addDays(DAY0, 1);
    return { s: ensureDailyProblem(emptyLearnState(), date), date };
  };

  it("a clean full solve: every step right first time", () => {
    const { s, date } = start("full");
    const done = solveDay(s, date);
    expect(problemDayOf(done, date)).toMatchObject({ done: true, outcome: "clean" });
  });

  it("retries and hints make it 'solved'; a reveal makes it 'shown'", () => {
    const { s: s0, date } = start("full");
    const p = getProblem(problemDayOf(s0, date)!.problemId)!;
    let s = recordStep(s0, date, 0, { type: "attempt", correct: false });
    expect(problemDayOf(s, date)!.steps[0]).toEqual({ status: "open", tries: 1, hint: false });
    s = recordStep(s, date, 0, { type: "hint" });
    s = recordStep(s, date, 0, { type: "attempt", correct: true });
    for (let k = 1; k < p.steps.length; k++) s = recordStep(s, date, k, { type: "attempt", correct: true });
    expect(problemDayOf(s, date)).toMatchObject({ done: true, outcome: "solved" });

    let t = recordStep(s0, date, 0, { type: "show" });
    for (let k = 1; k < p.steps.length; k++) t = recordStep(t, date, k, { type: "attempt", correct: true });
    expect(problemDayOf(t, date)!.outcome).toBe("shown");
  });

  it("on a part day only the key step counts", () => {
    const { s, date } = start("part");
    const day = problemDayOf(s, date)!;
    const p = getProblem(day.problemId)!;
    const other = p.part === 0 ? 1 : 0;
    expect(recordStep(s, date, other, { type: "attempt", correct: true })).toBe(s);
    const done = recordStep(s, date, p.part, { type: "attempt", correct: true });
    expect(problemDayOf(done, date)).toMatchObject({ done: true, outcome: "clean" });
    // Nothing changes after the day is closed.
    expect(recordStep(done, date, p.part, { type: "hint" })).toBe(done);
  });

  it("recentDays reports the last week oldest first", () => {
    let s = emptyLearnState();
    s = solveDay(s, DAY0);
    s = ensureDailyProblem(s, addDays(DAY0, 2));
    const week = recentDays(s, addDays(DAY0, 2), 3);
    expect(week.map((d) => d.date)).toEqual([DAY0, addDays(DAY0, 1), addDays(DAY0, 2)]);
    expect(week.map((d) => d.outcome)).toEqual(["clean", null, null]);
  });
});

describe("persistence", () => {
  it("keeps problem history through a save and load, and drops unknown problems", () => {
    const s = solveDay(emptyLearnState(), DAY0);
    const env = toEnvelope(s);
    const r = parseDocument(JSON.parse(JSON.stringify(env)));
    expect(r.ok && r.state.problemDays).toEqual(s.problemDays);

    const junk = { ...env, state: { ...env.state, problemDays: [...s.problemDays, { ...s.problemDays[0], date: "2026-11-03", problemId: "p.nope" }] } };
    const r2 = parseDocument(junk);
    expect(r2.ok && r2.state.problemDays).toHaveLength(1);
    expect(r2.ok && r2.dropped).toBe(1);
  });

  it("older documents without problem history load with an empty one", () => {
    const old: Record<string, unknown> = { ...emptyLearnState() };
    delete old.problemDays;
    const r = parseDocument(old);
    expect(r.ok && r.state.problemDays).toEqual([]);
  });

  it("every hand-written problem resolves by id", () => {
    for (const p of PROBLEMS) expect(getProblem(p.id)).toBe(p);
    expect(getProblem("p.alg.vieta~123")?.family).toBe("p.alg.vieta");
    expect(getProblem("p.alg.vieta~x")).toBeNull();
  });
});

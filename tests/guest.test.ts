import { describe, expect, it } from "vitest";
import {
  addProblems, deleteProblem, emptyState, isGuestState, logReview, markNothingToReview, reviewError, setProblemStatus, uid, updateSettings, type GuestState,
} from "@/lib/guest/engine";
import { parseAopsForm, parseCsv, parsePastedForm } from "@/lib/problem-input";

const MON = "2027-01-04";
const WED = "2027-01-06";

function form(entries: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

/** A finalized miss on a bank problem, as the old trainer recorded it (kept in saved data). */
function addMiss(s: GuestState, day: string) {
  const p = s.problems[0];
  const id = uid();
  s.attempts.push({
    id, problem_id: p.id, session_id: uid(), review_item_id: null, local_date: day, seconds: 60, answer: p.answer === "A" ? "B" : "A",
    correct: false, confidence: 2, familiar: false, key_idea: "Count the complement.", error_type: "careless", finalized: true, created_at: new Date().toISOString(),
  });
  return { id, problemId: p.id };
}
const errorReviewDone = (s: GuestState, day: string) => s.activity.some((a) => a.local_date === day && a.item === "error_review" && a.completed);

describe("guest error review", () => {
  it("reviewing the last miss completes the review item and rejects duplicates", () => {
    const s = emptyState("UTC");
    const miss = addMiss(s, MON);
    expect(markNothingToReview(s, WED).error).toBeTruthy();
    expect(reviewError(s, { attemptId: miss.id, takeaway: "no", minutes: 2 }, WED).error).toBeTruthy();
    expect(reviewError(s, { attemptId: miss.id, takeaway: "Re-read the question twice.", minutes: 2 }, WED)).toEqual({});
    expect(reviewError(s, { attemptId: miss.id, takeaway: "Re-read the question twice.", minutes: 2 }, WED).error).toBe("Already reviewed");
    expect(errorReviewDone(s, WED)).toBe(true);
  });

  it("counts learning-card misses towards the review", () => {
    const s = emptyState("UTC");
    expect(markNothingToReview(s, WED, { reviewedToday: 0, remaining: 2 }).error).toBeTruthy();
    logReview(s, WED, 3, { reviewedToday: 1, remaining: 1 });
    expect(errorReviewDone(s, WED)).toBe(false);
    logReview(s, WED, 3, { reviewedToday: 2, remaining: 0 });
    expect(errorReviewDone(s, WED)).toBe(true);
  });

  it("an empty log can be marked done", () => {
    const s = emptyState("UTC");
    expect(markNothingToReview(s, WED)).toEqual({});
    expect(errorReviewDone(s, WED)).toBe(true);
  });
});

describe("guest problem bank", () => {
  it("dedupes AoPS problems and allows sealing", () => {
    const s = emptyState("UTC");
    const p = parseAopsForm(form({ contest: "AMC 10A", year: "2016", number: "7", answer: "c", techniques: "casework", topics: "algebra" }));
    if (!p.ok) throw new Error(p.error);
    expect(addProblems(s, [p.value])).toEqual({ added: 1, skipped: 0 });
    expect(addProblems(s, [p.value])).toEqual({ added: 0, skipped: 1 });
    const id = s.problems.at(-1)!.id;
    expect(setProblemStatus(s, id, "vault")).toEqual({});
    expect(s.problems.at(-1)!.status).toBe("vault");
    expect(s.problems.at(-1)!.statement).toBeNull(); // AoPS stores links only, never text
  });

  it("deleting a problem removes its attempts and reviews", () => {
    const s = emptyState("UTC");
    const { id, problemId: missedId } = addMiss(s, MON);
    reviewError(s, { attemptId: id, takeaway: "Read carefully next time.", minutes: 1 }, WED);
    expect(deleteProblem(s, missedId)).toEqual({});
    expect(s.attempts.some((a) => a.problem_id === missedId)).toBe(false);
    expect(s.errorReviews).toHaveLength(0);
    expect(s.reviewItems.every((r) => r.origin_problem_id !== missedId)).toBe(true);
  });
});

describe("guest settings + backup", () => {
  it("validates settings", () => {
    const s = emptyState("UTC");
    const ok = { timezone: "America/Los_Angeles", amcDate: "2027-03-04", finalsStart: "", finalsEnd: "" };
    expect(updateSettings(s, ok)).toEqual({});
    expect(updateSettings(s, { ...ok, timezone: "Nope/Nowhere" }).error).toBe("Unknown time zone");
    expect(updateSettings(s, { ...ok, amcDate: "tomorrow" }).error).toBe("Check the dates");
    expect(updateSettings(s, { ...ok, finalsStart: "2027-02-02", finalsEnd: "2027-02-01" }).error).toBeTruthy();
  });

  it("round-trips through JSON and rejects foreign data", () => {
    const s = emptyState("UTC");
    addMiss(s, MON);
    expect(isGuestState(JSON.parse(JSON.stringify(s)))).toBe(true);
    // Older saves that still carry the move-based engine's progress keep loading.
    expect(isGuestState({ ...s, engine: { v: 1, skills: {}, logs: [], mistakes: [], queue: [] } })).toBe(true);
    expect(isGuestState({})).toBe(false);
    expect(isGuestState({ ...s, v: 2 })).toBe(false);
    expect(isGuestState({ ...s, attempts: "nope" })).toBe(false);
    expect(isGuestState(null)).toBe(false);
  });
});

describe("problem input parsing (shared with the server actions)", () => {
  it("parses pasted problems and requires all choices", () => {
    const base = { statement: "What is 1 + 1 in base ten?", answer: "b", difficulty: "3", techniques: "direct_counting", choiceA: "1", choiceB: "2", choiceC: "3", choiceD: "4", choiceE: "5" };
    const ok = parsePastedForm(form(base));
    expect(ok.ok && ok.value.answer).toBe("B");
    expect(parsePastedForm(form({ ...base, choiceE: "" }))).toEqual({ ok: false, error: "Fill in all five choices" });
  });

  it("rejects unknown tags and requires a technique", () => {
    const base = { contest: "AMC 10A", year: "2016", number: "7", answer: "C" };
    expect(parseAopsForm(form({ ...base, techniques: "" }))).toEqual({ ok: false, error: "Add at least one technique tag" });
    const bad = parseAopsForm(form({ ...base, techniques: "witchcraft" }));
    expect(!bad.ok && bad.error).toMatch(/Unknown tag/);
  });

  it("reports bad CSV rows and keeps good ones", () => {
    const { rows, errors } = parseCsv(
      "contest,year,number,answer,topic,techniques,status\nAMC 10A,2016,7,C,algebra,systems_of_equations,train\nAMC 10A,2016,99,C,algebra,casework\nAMC 10B,2017,3,D,,casework;symmetry,vault",
    );
    expect(rows).toHaveLength(2);
    expect(rows[1].status).toBe("vault");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/^Row 2:/);
  });
});

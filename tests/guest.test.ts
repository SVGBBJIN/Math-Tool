import { describe, expect, it } from "vitest";
import {
  addProblems, dayStatus, deleteProblem, emptyState, finalizeAttempt, getOrCreateSession, isGuestState,
  keptMap, markNothingToReview, reviewError, setProblemStatus, submitAttempt, updateSettings, type GuestState,
} from "@/lib/guest/engine";
import { parseAopsForm, parseCsv, parsePastedForm } from "@/lib/problem-input";
import { currentStreak } from "@/lib/plan";

const MON = "2027-01-04"; // a Monday: trainer day
const TUE = "2027-01-05";
const WED = "2027-01-06"; // error review day

function form(entries: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

/** Answer every problem in today's session; `wrong` picks problems to miss. */
function playSession(s: GuestState, day: string, wrong: (id: string) => boolean = () => false) {
  const session = getOrCreateSession(s, day)!;
  for (const id of session.problem_ids) {
    const p = s.problems.find((x) => x.id === id)!;
    const answer = wrong(id) ? (p.answer === "A" ? "B" : "A") : p.answer;
    const r = submitAttempt(s, { sessionId: session.id, problemId: id, answer, confidence: 2, familiar: false, seconds: 240 }, day);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error(r.error);
    const f = finalizeAttempt(s, { attemptId: r.attemptId, keyIdea: "Count the complement.", errorType: r.correct ? null : "careless" });
    expect(f.ok).toBe(true);
  }
  return session;
}

describe("guest trainer", () => {
  it("starts with sample problems and builds a 3-problem session once per day", () => {
    const s = emptyState("UTC");
    expect(s.problems.length).toBe(20);
    const a = getOrCreateSession(s, MON)!;
    expect(a.problem_ids).toHaveLength(3);
    expect(getOrCreateSession(s, MON)!.id).toBe(a.id);
    expect(s.sessions).toHaveLength(1);
  });

  it("completing the session completes the day and starts a streak", () => {
    const s = emptyState("UTC");
    playSession(s, MON);
    const status = dayStatus(s, MON);
    expect(status.complete).toBe(true);
    expect(currentStreak(keptMap(s, MON), MON)).toBe(1);
  });

  it("is idempotent per problem and hides nothing it shouldn't", () => {
    const s = emptyState("UTC");
    const session = getOrCreateSession(s, MON)!;
    const input = { sessionId: session.id, problemId: session.problem_ids[0], answer: "A", confidence: 1, familiar: false, seconds: 30 };
    const first = submitAttempt(s, input, MON);
    const second = submitAttempt(s, input, MON);
    expect(first.ok && second.ok && first.attemptId === second.attemptId).toBe(true);
    expect(s.attempts).toHaveLength(1);
  });

  it("rejects problems outside the session and bad input", () => {
    const s = emptyState("UTC");
    const session = getOrCreateSession(s, MON)!;
    const outside = s.problems.find((p) => !session.problem_ids.includes(p.id))!;
    const base = { sessionId: session.id, answer: "A", confidence: 2, familiar: false, seconds: 10 };
    expect(submitAttempt(s, { ...base, problemId: outside.id }, MON).ok).toBe(false);
    expect(submitAttempt(s, { ...base, problemId: session.problem_ids[0], answer: "Z" }, MON).ok).toBe(false);
    expect(submitAttempt(s, { ...base, problemId: session.problem_ids[0], confidence: 9 }, MON).ok).toBe(false);
  });

  it("a miss needs an error type and a key idea", () => {
    const s = emptyState("UTC");
    const session = getOrCreateSession(s, MON)!;
    const id = session.problem_ids[0];
    const p = s.problems.find((x) => x.id === id)!;
    const r = submitAttempt(s, { sessionId: session.id, problemId: id, answer: p.answer === "A" ? "B" : "A", confidence: 3, familiar: false, seconds: 60 }, MON);
    if (!r.ok) throw new Error(r.error);
    expect(finalizeAttempt(s, { attemptId: r.attemptId, keyIdea: "x", errorType: "careless" }).ok).toBe(false);
    expect(finalizeAttempt(s, { attemptId: r.attemptId, keyIdea: "A decent sentence.", errorType: null }).ok).toBe(false);
    expect(finalizeAttempt(s, { attemptId: r.attemptId, keyIdea: "A decent sentence.", errorType: "careless" }).ok).toBe(true);
  });

  it("a miss queues a review twin that shows up the next day, never the missed problem", () => {
    const s = emptyState("UTC");
    const first = playSession(s, MON, (id) => id === getOrCreateSession(s, MON)!.problem_ids[0]);
    const missedId = first.problem_ids[0];
    const item = s.reviewItems.find((r) => r.status === "pending")!;
    expect(item.due_date).toBe(TUE);
    expect(item.technique_tag).toBe(s.problems.find((p) => p.id === missedId)!.technique_tags[0]);

    // The sample bank may hold no other problem with that tag, so make sure a twin exists.
    const twin = parsePastedForm(form({
      statement: "A fresh twin problem for the missed technique.", answer: "A", difficulty: "6", techniques: item.technique_tag,
      choiceA: "1", choiceB: "2", choiceC: "3", choiceD: "4", choiceE: "5",
    }));
    if (!twin.ok) throw new Error(twin.error);
    addProblems(s, [twin.value]);

    const next = getOrCreateSession(s, TUE)!;
    const slot = next.slot_reasons.findIndex((r) => r === `twin:${item.technique_tag}`);
    expect(slot).toBeGreaterThanOrEqual(0);
    expect(next.review_item_ids[slot]).toBe(item.id);
    expect(next.problem_ids).not.toContain(missedId);
    for (const id of first.problem_ids) expect(next.problem_ids).not.toContain(id); // never repeats an attempted problem

    // Solving the twin cold advances the item to the next stage.
    const twinId = next.problem_ids[slot];
    const r = submitAttempt(s, { sessionId: next.id, problemId: twinId, answer: "A", confidence: 3, familiar: false, seconds: 100 }, TUE);
    expect(r.ok && r.correct).toBe(true);
    expect(s.reviewItems.find((x) => x.id === item.id)).toMatchObject({ stage: 1, due_date: "2027-01-08", status: "pending" });
  });

  it("returns null when the bank has nothing fresh", () => {
    const s = emptyState("UTC");
    s.problems.forEach((p) => (p.status = "burned"));
    expect(getOrCreateSession(s, MON)).toBeNull();
  });
});

describe("guest error review", () => {
  it("reviewing the last miss completes the review item and rejects duplicates", () => {
    const s = emptyState("UTC");
    const session = playSession(s, MON, (id) => id === getOrCreateSession(s, MON)!.problem_ids[0]);
    const miss = s.attempts.find((a) => a.session_id === session.id && !a.correct)!;
    expect(markNothingToReview(s, WED).error).toBeTruthy();
    expect(reviewError(s, { attemptId: miss.id, takeaway: "no", minutes: 2 }, WED).error).toBeTruthy();
    expect(reviewError(s, { attemptId: miss.id, takeaway: "Re-read the question twice.", minutes: 2 }, WED)).toEqual({});
    expect(reviewError(s, { attemptId: miss.id, takeaway: "Re-read the question twice.", minutes: 2 }, WED).error).toBe("Already reviewed");
    expect(dayStatus(s, WED).complete).toBe(true);
  });

  it("an empty log can be marked done", () => {
    const s = emptyState("UTC");
    expect(markNothingToReview(s, WED)).toEqual({});
    expect(dayStatus(s, WED).complete).toBe(true);
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
    const session = playSession(s, MON, (id) => id === getOrCreateSession(s, MON)!.problem_ids[0]);
    const missedId = session.problem_ids[0];
    const miss = s.attempts.find((a) => a.problem_id === missedId)!;
    reviewError(s, { attemptId: miss.id, takeaway: "Read carefully next time.", minutes: 1 }, WED);
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
    playSession(s, MON);
    expect(isGuestState(JSON.parse(JSON.stringify(s)))).toBe(true);
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

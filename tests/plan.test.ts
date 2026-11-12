import { describe, expect, it } from "vitest";
import { currentStreak, evaluateDay, requiredItems } from "@/lib/plan";
import { localDate } from "@/lib/dates";

// 2026-11-16 is a Monday.
const MON = "2026-11-16", TUE = "2026-11-17", WED = "2026-11-18", THU = "2026-11-19",
  FRI = "2026-11-20", SAT = "2026-11-21", SUN = "2026-11-22";

describe("requiredItems", () => {
  it("maps weekdays to the plan", () => {
    const off = { khanRequired: false };
    for (const d of [MON, TUE, THU, FRI]) expect(requiredItems(d, off)).toEqual(["trainer"]);
    expect(requiredItems(WED, off)).toEqual(["error_review"]);
    expect(requiredItems(SAT, off)).toEqual(["timed_block"]);
    expect(requiredItems(SUN, off)).toEqual(["saturday_review"]);
  });
  it("adds Khan when required", () => {
    expect(requiredItems(MON, { khanRequired: true })).toEqual(["trainer", "khan"]);
  });
});

describe("evaluateDay", () => {
  const req = requiredItems(MON, { khanRequired: true });
  it("is complete only when every required item is done", () => {
    const s = evaluateDay(req, [{ item: "trainer", minutes: 25, completed: true }]);
    expect(s.complete).toBe(false);
    expect(s.remaining).toEqual(["khan"]);
    expect(s.minimumMet).toBe(true); // 25 min >= 10
  });
  it("minimum day: 10 minutes of any plan item keeps the streak", () => {
    expect(evaluateDay(req, [{ item: "khan", minutes: 9.9, completed: false }]).minimumMet).toBe(false);
    expect(evaluateDay(req, [{ item: "khan", minutes: 10, completed: false }]).minimumMet).toBe(true);
  });
  it("complete day with zero tracked minutes still keeps the streak", () => {
    const s = evaluateDay(req, [
      { item: "trainer", minutes: 0, completed: true },
      { item: "khan", minutes: 0, completed: true },
    ]);
    expect(s.complete).toBe(true);
    expect(s.minimumMet).toBe(true);
  });
});

describe("currentStreak", () => {
  it("counts back from today when today is kept", () => {
    const kept = new Map([[MON, true], [TUE, true], [WED, true]]);
    expect(currentStreak(kept, WED)).toBe(3);
  });
  it("an unfinished today does not break the streak", () => {
    const kept = new Map([[MON, true], [TUE, true], [WED, false]]);
    expect(currentStreak(kept, WED)).toBe(2);
  });
  it("a missed day breaks it", () => {
    const kept = new Map([[MON, true], [TUE, false], [WED, true]]);
    expect(currentStreak(kept, WED)).toBe(1);
  });
  it("is zero with no history", () => {
    expect(currentStreak(new Map(), WED)).toBe(0);
  });
});

describe("localDate", () => {
  it("uses the household time zone, not UTC", () => {
    // 2026-11-17 05:30 UTC is still Nov 16 in Los Angeles.
    const t = new Date("2026-11-17T05:30:00Z");
    expect(localDate("America/Los_Angeles", t)).toBe("2026-11-16");
    expect(localDate("UTC", t)).toBe("2026-11-17");
  });
});

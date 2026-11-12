import { describe, expect, it } from "vitest";
import { applyMiss, applyTwinOutcome, isDue, REVIEW_INTERVALS } from "@/lib/review";

const T = "2026-11-16";

describe("spaced review", () => {
  it("a miss schedules a twin for tomorrow", () => {
    expect(applyMiss(null, T)).toEqual({ stage: 0, dueDate: "2026-11-17", status: "pending" });
  });

  it("correct cold solves walk 1 → 3 → 7 → 21 days then retire", () => {
    let item = applyMiss(null, T);
    const seen: number[] = [];
    let today = item.dueDate;
    for (let i = 0; i < 3; i++) {
      item = applyTwinOutcome(item, { correct: true, familiar: false }, today);
      seen.push(REVIEW_INTERVALS[item.stage]);
      today = item.dueDate;
    }
    expect(seen).toEqual([3, 7, 21]);
    expect(item.dueDate).toBe("2026-12-18"); // 11-17 +3 = 11-20, +7 = 11-27, +21 = 12-18
    item = applyTwinOutcome(item, { correct: true, familiar: false }, today);
    expect(item.status).toBe("retired");
  });

  it("a miss at any stage resets to 1 day", () => {
    const item = { stage: 2, dueDate: T, status: "pending" as const };
    expect(applyTwinOutcome(item, { correct: false, familiar: false }, T)).toEqual({
      stage: 0, dueDate: "2026-11-17", status: "pending",
    });
  });

  it("a familiar (seen-before) attempt does not move the item", () => {
    const item = { stage: 1, dueDate: T, status: "pending" as const };
    expect(applyTwinOutcome(item, { correct: true, familiar: true }, T)).toBe(item);
    expect(applyTwinOutcome(item, { correct: false, familiar: true }, T)).toBe(item);
  });

  it("isDue respects date and status", () => {
    expect(isDue({ stage: 0, dueDate: T, status: "pending" }, T)).toBe(true);
    expect(isDue({ stage: 0, dueDate: "2026-11-17", status: "pending" }, T)).toBe(false);
    expect(isDue({ stage: 0, dueDate: T, status: "retired" }, T)).toBe(false);
  });
});

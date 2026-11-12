import { describe, expect, it } from "vitest";
import { KHAN_TARGET_MINUTES, KhanEntrySchema, accuracyLabel, isKhanUrl, summarizeKhanDay } from "@/lib/khan";

const valid = {
  unit: "Trigonometry",
  skill: "Unit circle",
  minutes: 25,
  questionsCorrect: 8,
  questionsTotal: 10,
  proofNote: "Worked the unit circle exercise, missed two sign questions.",
};

describe("KhanEntrySchema", () => {
  it("accepts a valid entry, with or without a link", () => {
    expect(KhanEntrySchema.safeParse(valid).success).toBe(true);
    expect(KhanEntrySchema.safeParse({ ...valid, proofUrl: "https://www.khanacademy.org/math/precalculus" }).success).toBe(true);
    expect(KhanEntrySchema.safeParse({ ...valid, proofUrl: "" }).success).toBe(true);
  });
  it("rejects thin proof notes", () => {
    expect(KhanEntrySchema.safeParse({ ...valid, proofNote: "did stuff" }).success).toBe(false);
  });
  it("rejects correct > total and non-whole or out-of-range minutes", () => {
    expect(KhanEntrySchema.safeParse({ ...valid, questionsCorrect: 11 }).success).toBe(false);
    expect(KhanEntrySchema.safeParse({ ...valid, minutes: 0 }).success).toBe(false);
    expect(KhanEntrySchema.safeParse({ ...valid, minutes: 181 }).success).toBe(false);
    expect(KhanEntrySchema.safeParse({ ...valid, minutes: 12.5 }).success).toBe(false);
  });
});

describe("isKhanUrl", () => {
  it("only allows https khanacademy.org links", () => {
    expect(isKhanUrl("https://khanacademy.org/x")).toBe(true);
    expect(isKhanUrl("https://www.khanacademy.org/x")).toBe(true);
    expect(isKhanUrl("http://www.khanacademy.org/x")).toBe(false);
    expect(isKhanUrl("https://khanacademy.org.evil.com/x")).toBe(false);
    expect(isKhanUrl("https://evilkhanacademy.org/x")).toBe(false);
    expect(isKhanUrl("javascript:alert(1)")).toBe(false);
    expect(isKhanUrl("not a url")).toBe(false);
  });
});

describe("summarizeKhanDay", () => {
  it("completes at the target and sums multiple entries", () => {
    expect(summarizeKhanDay([]).completed).toBe(false);
    expect(summarizeKhanDay([{ minutes: 10 }])).toEqual({ minutes: 10, remainingMinutes: KHAN_TARGET_MINUTES - 10, completed: false });
    expect(summarizeKhanDay([{ minutes: 10 }, { minutes: 10 }]).completed).toBe(true);
  });
});

describe("accuracyLabel", () => {
  it("formats accuracy and handles zero questions", () => {
    expect(accuracyLabel(8, 10)).toBe("8/10 (80%)");
    expect(accuracyLabel(0, 0)).toBeNull();
  });
});

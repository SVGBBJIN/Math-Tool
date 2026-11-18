// A complete student journey through the real engines, from a first visit to mastery,
// with nothing but the daily plan deciding what comes next.
import { expect, it } from "vitest";
import { addDays } from "@/lib/dates";
import { getCard } from "@/lib/learn/cards";
import { snapshots } from "@/lib/learn/mastery";
import { scheduleOf } from "@/lib/learn/review";
import { buildDaily, dailyStatus, ensureDaily } from "@/lib/learn/select";
import { localRepository, memoryStore } from "@/lib/learn/persistence";
import type { LearnState } from "@/lib/learn/state";
import { DAY0, answer } from "./helpers";

it("first visit → insight → technique → reinforcement → application → mastery → review after a break", async () => {
  const store = memoryStore();
  const repo = (day: string) => localRepository(store, "guest", () => new Date(`${day}T08:00:00Z`));

  // 1. First open: nothing stored, today's three cards are ready at once.
  let day = DAY0;
  let s: LearnState = (await repo(day).load()).state;
  s = ensureDaily(s, day);
  const first = s.daily!.slots.map((x) => getCard(x.cardId)!);
  expect(first).toHaveLength(3);
  const concept = first[0].conceptId;
  // 2–4. It begins a concept with an insight card, then a technique card.
  expect(first[0].type).toBe("insight");
  expect(first.some((c) => c.type === "technique")).toBe(true);
  for (const slot of s.daily!.slots) s = answer(s, slot.cardId, day, { slot: slot.role });
  expect(dailyStatus(s, day).complete).toBe(true);
  expect(snapshots(s.events).get(concept)!.state).toBe("developing");
  await repo(day).save(s);

  // 5. Next day: the record survives a reload, and the concept comes back as reinforcement.
  day = addDays(DAY0, 1);
  s = (await repo(day).load()).state;
  expect(scheduleOf(s.events.filter((e) => e.conceptId === concept))!.due).toBe(day);
  s = ensureDaily(s, day);
  const reinforce = s.daily!.slots.find((x) => x.role === "reinforce")!;
  expect(reinforce.conceptId).toBe(concept);
  expect(reinforce.reason).toMatch(/Review|spot/);

  // 6–7. Keep doing the daily cards. Progress is driven by evidence: the concept reaches
  // Proficient only after applications on new problems and a variation.
  const states: string[] = [];
  for (let i = 1; i <= 21; i++) {
    day = addDays(DAY0, i);
    s = ensureDaily(s, day);
    for (const slot of s.daily!.slots) s = answer(s, slot.cardId, day, { slot: slot.role });
    await repo(day).save(s);
    states.push(snapshots(s.events).get(concept)!.state);
  }
  expect(states).toContain("practicing");
  expect(states).toContain("proficient");
  const snap = snapshots(s.events).get(concept)!;
  expect(snap.evidence.application.clean).toBeGreaterThanOrEqual(2);
  expect(snap.evidence.transfer.clean).toBeGreaterThanOrEqual(1);
  // Several other concepts have been opened along the way, across more than one domain.
  const seen = [...snapshots(s.events).values()].filter((x) => x.seen);
  expect(seen.length).toBeGreaterThanOrEqual(4);
  expect(new Set(seen.map((x) => x.conceptId.split(".")[0])).size).toBeGreaterThanOrEqual(2);

  // 8. Two weeks away. On return, the plan is review of what was learned, not new material first.
  day = addDays(day, 14);
  s = (await repo(day).load()).state;
  const plan = buildDaily(s, day);
  const learned = new Set(seen.map((x) => x.conceptId));
  const reviews = plan.slots.filter((x) => learned.has(x.conceptId));
  expect(reviews.length).toBeGreaterThanOrEqual(2);
  expect(plan.slots[0].role === "reinforce" || plan.slots[1].role === "reinforce").toBe(true);
  expect(plan.slots.some((x) => x.reason.startsWith("Review"))).toBe(true);

  // Retention after the gap is what turns Proficient into Mastered.
  s = ensureDaily(s, day);
  for (let i = 0; i < 20; i++) {
    const d = addDays(day, i);
    s = ensureDaily(s, d);
    for (const slot of s.daily!.slots) s = answer(s, slot.cardId, d, { slot: slot.role });
  }
  expect([...snapshots(s.events).values()].some((x) => x.state === "mastered")).toBe(true);
});

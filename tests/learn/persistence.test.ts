import { describe, expect, it } from "vitest";
import { snapshots } from "@/lib/learn/mastery";
import { isLegacyDocument, mergeLegacy, migrateLegacy } from "@/lib/learn/legacy";
import { localRepository, memoryStore, parseDocument, STORAGE_PREFIX, toEnvelope } from "@/lib/learn/persistence";
import { emptyLearnState, LEARN_VERSION } from "@/lib/learn/state";
import { DAY0, playDay } from "./helpers";

const KEY = `${STORAGE_PREFIX}:guest`;
const clock = (iso: string) => () => new Date(iso);

/** A version-1 document as the move-based engine saved it. */
const legacyDoc = {
  v: 1, dial: 0, skills: { "quad.gcf": { stage: "reps" } }, queue: [], daily: null,
  logs: [
    { at: "2026-11-10T10:00:00Z", date: "2026-11-10", cardId: "quad.gcf.r1", topic: "algebra", skill: "quad.gcf", type: "rep", source: "new", level: 1, seconds: 20, wrongMoves: 0, hintLevel: 0, result: "pass", skippedKeyMove: false },
    { at: "2026-11-10T10:01:00Z", date: "2026-11-10", cardId: "count.arrange.r1", topic: "counting_probability", skill: "count.arrange", type: "rep", source: "new", level: 1, seconds: 35, wrongMoves: 0, hintLevel: 0, result: "timeout", skippedKeyMove: false },
    { at: "2026-11-11T10:00:00Z", date: "2026-11-11", cardId: "count.committee~rep~12", topic: "counting_probability", skill: "count.committee", type: "twist", source: "stretch", level: 2, seconds: 40, wrongMoves: 1, hintLevel: 1, result: "assisted", skippedKeyMove: false },
    { at: "2026-11-11T10:02:00Z", date: "2026-11-11", cardId: "x", skill: "mystery.skill", type: "rep", result: "pass" },
  ],
  mistakes: [
    { id: "m1", at: "2026-11-10T10:01:00Z", date: "2026-11-10", cardId: "count.arrange.r1", skill: "count.arrange", topic: "counting_probability", problem: "Six books…", userAnswer: "6·5", correctAnswer: "30", seconds: 35, outcome: "timeout", errorType: "out_of_time", note: "", takeaway: "Slow down", reviewedOn: "2026-11-11" },
  ],
};

describe("save and restore", () => {
  it("round-trips through storage and through a backup file", async () => {
    const store = memoryStore();
    const repo = localRepository(store, "guest", clock(`${DAY0}T09:00:00Z`));
    expect((await repo.load()).status).toBe("fresh");
    const s = playDay(emptyLearnState(), DAY0);
    await repo.save(s);
    const loaded = await repo.load();
    expect(loaded).toMatchObject({ status: "loaded", notice: null });
    expect(loaded.state).toEqual(s);

    const file = await repo.exportBackup();
    const other = localRepository(memoryStore(), "guest");
    const restored = await other.importBackup(file);
    expect(restored.ok && restored.state).toEqual(s);
    expect((await other.importBackup("{nope")).ok).toBe(false);
    expect((await other.importBackup(JSON.stringify({ hello: 1 }))).ok).toBe(false);
  });

  it("keeps a daily backup and a copy before restore or reset", async () => {
    const store = memoryStore();
    const repo = localRepository(store, "guest", clock(`${DAY0}T09:00:00Z`));
    await repo.save(emptyLearnState());
    await repo.save(playDay(emptyLearnState(), DAY0));
    await repo.reset();
    const backups = store.keys().filter((k) => k.includes(":backup:"));
    expect(backups.some((k) => k.endsWith(DAY0))).toBe(true);
    expect(backups.some((k) => k.includes("before-reset"))).toBe(true);
  });
});

describe("validation and recovery", () => {
  it("drops individual bad entries and keeps the rest", () => {
    const s = playDay(emptyLearnState(), DAY0);
    const doc = JSON.parse(JSON.stringify(toEnvelope(s)));
    doc.state.events.push({ id: "bad", outcome: "maybe" }, { ...doc.state.events[0], conceptId: "no.such.concept", id: "x2" });
    doc.state.events.push({ ...doc.state.events[0] }); // duplicate id
    const r = parseDocument(doc);
    expect(r.ok && r.dropped).toBe(3);
    expect(r.ok && r.state.events).toEqual(s.events);
  });

  it("refuses documents from a newer version and foreign data", () => {
    expect(parseDocument({ v: LEARN_VERSION + 1, events: [], misses: [] })).toMatchObject({ ok: false });
    expect(parseDocument({ v: 1, foo: [] })).toMatchObject({ ok: false });
    expect(parseDocument(null)).toMatchObject({ ok: false });
    expect(parseDocument("text")).toMatchObject({ ok: false });
  });

  it("sets aside corrupt data and restores the newest good backup", async () => {
    const store = memoryStore();
    const good = playDay(emptyLearnState(), DAY0);
    await localRepository(store, "guest", clock(`${DAY0}T09:00:00Z`)).save(good);
    await localRepository(store, "guest", clock("2027-01-05T09:00:00Z")).save(good); // makes a dated backup of the good copy
    store.setItem(KEY, "{\"v\":2,\"events\":"); // truncated write
    const r = await localRepository(store, "guest", clock("2027-01-06T09:00:00Z")).load();
    expect(r.status).toBe("recovered");
    expect(r.state.events).toEqual(good.events);
    expect(r.notice).toMatch(/backup was restored/);
    expect(store.keys().some((k) => k.includes(":corrupt:"))).toBe(true);
  });

  it("falls back to a fresh start, keeping the unreadable copy, when there is no backup", async () => {
    const store = memoryStore({ [KEY]: "garbage" });
    const r = await localRepository(store, "guest").load();
    expect(r).toMatchObject({ status: "recovered" });
    expect(r.state.events).toEqual([]);
    expect(store.keys().filter((k) => k.includes(":corrupt:")).map((k) => store.getItem(k))).toEqual(["garbage"]);
  });
});

describe("migration from the move-based engine (v1)", () => {
  it("maps skills to concepts, keeps mistakes, drops timeouts and unknown skills", () => {
    expect(isLegacyDocument(legacyDoc)).toBe(true);
    const { state, dropped } = migrateLegacy(legacyDoc);
    expect(dropped).toBe(1); // the unknown skill
    expect(state.events.map((e) => e.conceptId)).toEqual(["alg.factoring", "cp.overcounting"]);
    expect(state.events.every((e) => e.legacy)).toBe(true);
    expect(state.misses).toHaveLength(1);
    expect(state.misses[0]).toMatchObject({ conceptId: "cp.multiplication", takeaway: "Slow down" });
  });

  it("treats old work as exposure, never as mastery evidence", () => {
    const { state } = migrateLegacy(legacyDoc);
    const snaps = snapshots(state.events);
    expect(snaps.get("alg.factoring")!.state).toBe("developing");
    expect(snaps.get("alg.factoring")!.evidence.application.clean).toBe(0);
  });

  it("is applied automatically when a v1 document is loaded, with the original kept as a backup", async () => {
    const store = memoryStore({ [KEY]: JSON.stringify(legacyDoc) });
    const r = await localRepository(store, "guest", clock("2027-01-04T09:00:00Z")).load();
    expect(r.status).toBe("migrated");
    expect(r.notice).toMatch(/1 old entry could not be carried over/);
    expect(JSON.parse(store.getItem(KEY)!).state.v).toBe(LEARN_VERSION);
    expect(store.keys().some((k) => k.includes("before-v2"))).toBe(true);
  });

  it("merges into an existing record once", () => {
    const s = playDay(emptyLearnState(), DAY0);
    const once = mergeLegacy(s, legacyDoc);
    expect(once.events.length).toBe(s.events.length + 2);
    expect(mergeLegacy(once, legacyDoc)).toBe(once);
  });
});

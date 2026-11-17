// Persistence layer: reading, validating, migrating and saving the learning record.
//
// The engines never touch storage. They work on a LearnState value; this module is the
// only place that knows where it lives. `LearnRepository` is the seam for a future
// backend: implement the same five methods against a server and nothing else changes.
//
// Local storage layout (per scope: "guest" or a signed-in user id):
//   <base>                  the current document, wrapped in an envelope with its version
//   <base>:backup:<date>    the document as it stood at the first save of a day (last 5 kept)
//   <base>:corrupt:<stamp>  an unreadable document, set aside rather than overwritten (last 2 kept)
import { z } from "zod";
import { getCard } from "./cards";
import { conceptOf } from "./curriculum";
import { isLegacyDocument, migrateLegacy } from "./legacy";
import { LEARN_VERSION, MAX_EVENTS, emptyLearnState, type LearnState } from "./state";

export const STORAGE_PREFIX = "amc-coach:learn";
export const BACKUPS_KEPT = 5;

// ---- validation -----------------------------------------------------------------------
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const outcome = z.enum(["correct", "incorrect", "skipped"]);
const EvidenceSchema = z.object({
  id: z.string().min(1), at: z.string().min(1), date,
  cardId: z.string().min(1), family: z.string().min(1), conceptId: z.string().min(1), objectiveId: z.string().min(1),
  dimension: z.enum(["comprehension", "recognition", "application", "transfer"]),
  outcome, attempts: z.number().int().min(0).max(2), hintUsed: z.boolean(), selfReported: z.boolean(),
  slot: z.enum(["discover", "reinforce", "apply", "extra", "explore"]),
  gapDays: z.number().int().min(0).nullable(), repeat: z.boolean(), legacy: z.boolean().optional(),
});
const SlotSchema = z.object({
  role: z.enum(["discover", "reinforce", "apply"]), cardId: z.string().min(1), conceptId: z.string().min(1), reason: z.string(), done: z.boolean(), outcome: outcome.nullable(),
});
const MissSchema = z.object({
  id: z.string().min(1), at: z.string(), date, cardId: z.string(), conceptId: z.string(), problem: z.string(), userAnswer: z.string(), correctAnswer: z.string(),
  outcome: z.enum(["incorrect", "skipped"]), errorType: z.string().nullable(), note: z.string(), takeaway: z.string().nullable(), reviewedOn: z.string().nullable(),
});

export type ParseResult =
  | { ok: true; state: LearnState; migratedFrom: number | null; dropped: number }
  | { ok: false; reason: string };

/** Migrations by the version they start from. Each returns a document one version newer. */
const MIGRATIONS: Record<number, (doc: unknown) => { doc: unknown; dropped: number }> = {
  1: (doc) => { const r = migrateLegacy(doc); return { doc: r.state, dropped: r.dropped }; },
};

/**
 * Turn anything (a stored envelope, a bare state, a backup file, a version-1 document) into
 * a valid current LearnState, or say why not. Individual bad entries are dropped and
 * counted; the rest of the record survives.
 */
export function parseDocument(raw: unknown): ParseResult {
  if (!raw || typeof raw !== "object") return { ok: false, reason: "not a learning record" };
  let doc: unknown = raw;
  const env = raw as Record<string, unknown>;
  if (env.kind === "learn" && "state" in env) doc = env.state;
  if (!doc || typeof doc !== "object") return { ok: false, reason: "not a learning record" };

  let version = (doc as Record<string, unknown>).v;
  if (typeof version !== "number") return { ok: false, reason: "no version number" };
  if (version > LEARN_VERSION) return { ok: false, reason: `saved by a newer version of the app (v${version})` };
  if (version === 1 && !isLegacyDocument(doc)) return { ok: false, reason: "not a learning record" };
  const from = version;
  let dropped = 0;
  while (version < LEARN_VERSION) {
    const step = MIGRATIONS[version as number];
    if (!step) return { ok: false, reason: `no migration from v${version}` };
    const r = step(doc);
    doc = r.doc;
    dropped += r.dropped;
    version = (doc as Record<string, unknown>).v as number;
  }

  const o = doc as Record<string, unknown>;
  if (!Array.isArray(o.events) || !Array.isArray(o.misses)) return { ok: false, reason: "missing evidence log" };
  const events = o.events.flatMap((e) => { const r = EvidenceSchema.safeParse(e); return r.success && conceptOf(r.data.conceptId) ? [r.data] : []; });
  const misses = o.misses.flatMap((m) => { const r = MissSchema.safeParse(m); return r.success ? [r.data] : []; });
  dropped += o.events.length - events.length + (o.misses.length - misses.length);
  // Ids must be unique (a merged or hand-edited file may repeat them).
  const seen = new Set<string>();
  const unique = events.filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)));
  dropped += events.length - unique.length;
  unique.sort((a, b) => a.at.localeCompare(b.at));

  let daily: LearnState["daily"] = null;
  const d = z.object({ date, slots: z.array(SlotSchema).max(6) }).safeParse(o.daily);
  // A plan that points at cards which no longer exist is discarded; it is rebuilt on open.
  if (d.success && d.data.slots.every((s) => getCard(s.cardId))) daily = d.data;

  return {
    ok: true,
    state: { v: LEARN_VERSION, createdAt: typeof o.createdAt === "string" ? o.createdAt : new Date().toISOString(), events: unique.slice(-MAX_EVENTS), daily, misses },
    migratedFrom: from < LEARN_VERSION ? from : null,
    dropped,
  };
}

export const toEnvelope = (state: LearnState, now: Date = new Date()) => ({ app: "amc-coach", kind: "learn", v: LEARN_VERSION, savedAt: now.toISOString(), state });

// ---- storage --------------------------------------------------------------------------
/** The slice of the Web Storage API this module needs. localStorage satisfies it. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  keys(): string[];
}
export function memoryStore(initial: Record<string, string> = {}): KeyValueStore {
  const map = new Map(Object.entries(initial));
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v), removeItem: (k) => void map.delete(k), keys: () => [...map.keys()] };
}
export function browserStore(): KeyValueStore | null {
  try {
    const ls = window.localStorage;
    const probe = `${STORAGE_PREFIX}:probe`;
    ls.setItem(probe, "1");
    ls.removeItem(probe);
    return { getItem: (k) => ls.getItem(k), setItem: (k, v) => ls.setItem(k, v), removeItem: (k) => ls.removeItem(k), keys: () => Array.from({ length: ls.length }, (_, i) => ls.key(i)!).filter(Boolean) };
  } catch {
    return null;
  }
}

export type LoadStatus = "fresh" | "loaded" | "migrated" | "recovered";
export interface LoadResult {
  state: LearnState;
  status: LoadStatus;
  /** Something the student should be told (data was repaired, restored from a backup, or could not be read). */
  notice: string | null;
}
export interface LearnRepository {
  load(): Promise<LoadResult>;
  save(state: LearnState): Promise<void>;
  /** A JSON backup of the current record. */
  exportBackup(): Promise<string>;
  /** Replace the record with a backup file's contents. The current record is kept as a backup first. */
  importBackup(json: string): Promise<{ ok: true; state: LearnState } | { ok: false; error: string }>;
  /** Start over. The current record is kept as a backup first. */
  reset(): Promise<LearnState>;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function localRepository(store: KeyValueStore, scope: string, now: () => Date = () => new Date()): LearnRepository {
  const base = `${STORAGE_PREFIX}:${scope}`;
  const backups = () => store.keys().filter((k) => k.startsWith(`${base}:backup:`)).sort();
  const prune = (prefix: string, keep: number) => {
    const keys = store.keys().filter((k) => k.startsWith(prefix)).sort();
    for (const k of keys.slice(0, Math.max(0, keys.length - keep))) store.removeItem(k);
  };
  const read = (key: string): ParseResult | null => {
    const raw = store.getItem(key);
    if (raw === null) return null;
    try { return parseDocument(JSON.parse(raw)); } catch { return { ok: false, reason: "not valid JSON" }; }
  };
  const write = (state: LearnState) => store.setItem(base, JSON.stringify(toEnvelope(state, now())));
  /** Keep the stored document under a backup key before it is replaced. */
  const stash = (label: string) => {
    const raw = store.getItem(base);
    if (raw === null) return;
    store.setItem(`${base}:backup:${label}`, raw);
    prune(`${base}:backup:`, BACKUPS_KEPT);
  };

  return {
    async load() {
      const main = read(base);
      if (main === null) return { state: emptyLearnState(now()), status: "fresh", notice: null };
      if (main.ok) {
        if (main.migratedFrom !== null) {
          stash(`${now().toISOString().slice(0, 10)}-before-v${LEARN_VERSION}`);
          write(main.state);
          return { state: main.state, status: "migrated", notice: main.dropped ? `Your progress was updated to the new format. ${plural(main.dropped, "old entry").replace("entrys", "entries")} could not be carried over.` : null };
        }
        return { state: main.state, status: "loaded", notice: main.dropped ? `${plural(main.dropped, "damaged entry").replace("entrys", "entries")} in your saved progress could not be read and ${main.dropped === 1 ? "was" : "were"} left out. Everything else is intact.` : null };
      }
      // Unreadable: set it aside (never overwrite it blindly) and fall back to the newest good backup.
      store.setItem(`${base}:corrupt:${now().toISOString()}`, store.getItem(base)!);
      prune(`${base}:corrupt:`, 2);
      for (const key of backups().reverse()) {
        const b = read(key);
        if (b?.ok) {
          write(b.state);
          return { state: b.state, status: "recovered", notice: `Your saved progress could not be read (${main.reason}), so the most recent backup was restored. The unreadable copy was kept.` };
        }
      }
      store.removeItem(base);
      return { state: emptyLearnState(now()), status: "recovered", notice: `Your saved progress could not be read (${main.reason}) and there was no backup to restore, so this is a fresh start. The unreadable copy was kept in this browser.` };
    },
    async save(state) {
      const today = now().toISOString().slice(0, 10);
      if (!store.keys().includes(`${base}:backup:${today}`)) stash(today);
      write(state);
    },
    async exportBackup() {
      const current = read(base);
      return JSON.stringify(toEnvelope(current?.ok ? current.state : emptyLearnState(now()), now()), null, 2);
    },
    async importBackup(json) {
      let parsed: unknown;
      try { parsed = JSON.parse(json); } catch { return { ok: false, error: "That file isn't valid JSON." }; }
      const r = parseDocument(parsed);
      if (!r.ok) return { ok: false, error: `That file isn't an AMC Coach learning backup (${r.reason}).` };
      stash(`${now().toISOString()}-before-restore`);
      write(r.state);
      return { ok: true, state: r.state };
    },
    async reset() {
      stash(`${now().toISOString()}-before-reset`);
      const fresh = emptyLearnState(now());
      write(fresh);
      return fresh;
    },
  };
}

/** Used when the browser refuses storage: everything works, nothing is kept after the tab closes. */
export const volatileRepository = (now?: () => Date) => localRepository(memoryStore(), "volatile", now);

// The Daily Problem: lookup, answer checking, the day's pick, and recording progress.
// Pure functions over LearnState, like the card engines; the UI only calls these.
import { addDays } from "../../dates";
import { parseRational, rEq } from "../math/rational";
import type { LearnState } from "../state";
import { PROBLEMS, PROBLEM_FAMILIES } from "./bank";
import { PROBLEM_DOMAINS, type Problem, type ProblemDay, type ProblemDomain, type ProblemMode, type Step, type StepProgress } from "./types";

export * from "./types";
export { PROBLEMS, PROBLEM_FAMILIES };

/** How many days of problem history are kept. */
export const PROBLEM_HISTORY_DAYS = 180;

const byId = new Map(PROBLEMS.map((p) => [p.id, p]));
const families = new Map(PROBLEM_FAMILIES.map((f) => [f.id, f]));
const cache = new Map<string, Problem>();

/** A hand-written problem by id, or a generated one by "<family>~<seed>". */
export function getProblem(id: string): Problem | null {
  const fixed = byId.get(id);
  if (fixed) return fixed;
  const [famId, seedText] = id.split("~");
  const fam = families.get(famId);
  const seed = Number(seedText);
  if (!fam || !Number.isInteger(seed) || seed < 0) return null;
  if (!cache.has(id)) cache.set(id, fam.make(seed));
  return cache.get(id)!;
}
/** What counts as "the same problem" when avoiding repeats. */
export const baseOf = (problemId: string) => problemId.split("~")[0];

// ---- checking ---------------------------------------------------------------------------
export type StepAnswer = { kind: "numeric"; text: string } | { kind: "choice"; id: string } | { kind: "amc"; index: number };
export interface StepCheck { status: "correct" | "incorrect" | "invalid"; message: string }

const LETTERS = ["A", "B", "C", "D", "E"];
export const letter = (k: number) => LETTERS[k] ?? "?";

export function checkStep(step: Step, answer: StepAnswer): StepCheck {
  const i = step.input;
  if (i.kind !== answer.kind) return { status: "invalid", message: "That answer doesn't fit this step." };
  switch (i.kind) {
    case "numeric": {
      const text = (answer as Extract<StepAnswer, { kind: "numeric" }>).text;
      const got = parseRational(text);
      if (!got) return { status: "invalid", message: text.trim() ? "Enter a number, like 42, −3 or 5/8." : "Type your answer first." };
      const want = parseRational(i.answer)!;
      if (rEq(got, want)) return { status: "correct", message: "" };
      const slip = i.slips?.find((s) => { const v = parseRational(s.answer); return !!v && rEq(v, got); });
      return { status: "incorrect", message: slip?.feedback ?? "Not quite. Look at the hint, or try again." };
    }
    case "choice": {
      const id = (answer as Extract<StepAnswer, { kind: "choice" }>).id;
      const picked = i.options.find((o) => o.id === id);
      if (!picked) return { status: "invalid", message: "Pick one of the options." };
      return { status: picked.id === i.answer ? "correct" : "incorrect", message: picked.feedback ?? "" };
    }
    case "amc": {
      const index = (answer as Extract<StepAnswer, { kind: "amc" }>).index;
      if (index < 0 || index >= i.values.length) return { status: "invalid", message: "Pick one of the five choices." };
      return { status: index === i.answer ? "correct" : "incorrect", message: index === i.answer ? "" : "Not that one. Re-read the last step's work, or use the hint." };
    }
  }
}

/** The key as a student would write it. */
export function stepAnswerText(step: Step): string {
  const i = step.input;
  if (i.kind === "numeric") return i.answer + (i.unit ? ` ${i.unit}` : "");
  if (i.kind === "choice") return i.options.find((o) => o.id === i.answer)?.text ?? i.answer;
  return `(${letter(i.answer)}) ${i.values[i.answer]}`;
}

// ---- the day's problem ------------------------------------------------------------------
/** Deterministic hash of a string (FNV-1a), for picking from a list by date. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
const dayNumber = (date: string) => Math.round(Date.parse(`${date}T12:00:00Z`) / 86_400_000);

/** Full solve and solve-one-part alternate day by day. */
export const modeFor = (date: string): ProblemMode => (dayNumber(date) % 2 === 0 ? "full" : "part");

const SOURCES: { base: string; domain: ProblemDomain }[] = [
  ...PROBLEMS.map((p) => ({ base: p.id, domain: p.domain })),
  ...PROBLEM_FAMILIES.map((f) => ({ base: f.id, domain: f.domain })),
];

/**
 * Choose the problem for `date`. The domain practised least recently goes next, so any four
 * days in a row cover all four. Within it, the problem seen longest ago (never seen first),
 * which spaces repeats as widely as the bank allows; a family gets a fresh seed, so its
 * numbers differ each time it comes back.
 */
export function pickProblem(history: ProblemDay[], date: string): string {
  const lastSeen = new Map<string, string>();
  const lastDomain = new Map<ProblemDomain, string>();
  for (const d of history) {
    if (d.date >= date) continue;
    lastSeen.set(baseOf(d.problemId), d.date);
    const p = getProblem(d.problemId);
    if (p) lastDomain.set(p.domain, d.date);
  }
  const h = hash(date);
  const [{ dom }] = PROBLEM_DOMAINS
    .map((dom, k) => ({ dom, last: lastDomain.get(dom) ?? "", tie: (h >>> (k * 3)) & 7 }))
    .sort((a, b) => a.last.localeCompare(b.last) || a.tie - b.tie);
  const seen = (s: { base: string }) => lastSeen.get(s.base) ?? "";
  const inDomain = SOURCES.filter((s) => s.domain === dom);
  const oldest = inDomain.map(seen).sort()[0];
  const tied = inDomain.filter((s) => seen(s) === oldest);
  return withSeed(tied[h % tied.length].base, date);
}

/** The shortest gap, in days, before a problem can come back: the size of the smallest domain times four. */
export const REPEAT_GAP_DAYS = Math.min(...PROBLEM_DOMAINS.map((d) => SOURCES.filter((s) => s.domain === d).length)) * PROBLEM_DOMAINS.length;
const withSeed = (base: string, date: string) => (families.has(base) ? `${base}~${hash(`${date}:${base}`) % 100_000}` : base);

const freshSteps = (p: Problem): StepProgress[] => p.steps.map(() => ({ status: "open", tries: 0, hint: false }));

/** The steps the student answers on this day: all of them, or only the key step. */
export function ownedSteps(p: Problem, mode: ProblemMode): number[] {
  return mode === "full" ? p.steps.map((_, k) => k) : [p.part];
}

/** Make sure today's problem exists. Returns the same state object when nothing changes. */
export function ensureDailyProblem(state: LearnState, date: string): LearnState {
  const history = state.problemDays ?? [];
  const today = history.find((d) => d.date === date);
  if (today && getProblem(today.problemId)) return state;
  const problemId = pickProblem(history, date);
  const p = getProblem(problemId)!;
  const day: ProblemDay = { date, problemId, mode: modeFor(date), steps: freshSteps(p), done: false, outcome: null };
  const keepFrom = addDays(date, -PROBLEM_HISTORY_DAYS);
  return { ...state, problemDays: [...history.filter((d) => d.date !== date && d.date >= keepFrom), day] };
}

export const problemDayOf = (state: LearnState, date: string) => (state.problemDays ?? []).find((d) => d.date === date) ?? null;

export type StepEvent = { type: "attempt"; correct: boolean } | { type: "hint" } | { type: "show" };

/** Record what happened on one step, and close the day once every owned step is settled. */
export function recordStep(state: LearnState, date: string, stepIndex: number, ev: StepEvent): LearnState {
  const day = problemDayOf(state, date);
  if (!day || day.done) return state;
  const p = getProblem(day.problemId);
  if (!p || !ownedSteps(p, day.mode).includes(stepIndex)) return state;
  const prev = day.steps[stepIndex];
  if (prev.status !== "open") return state;
  const next: StepProgress =
    ev.type === "hint" ? { ...prev, hint: true }
    : ev.type === "show" ? { ...prev, status: "shown" }
    : { ...prev, tries: prev.tries + 1, status: ev.correct ? "solved" : "open" };
  const steps = day.steps.map((s, k) => (k === stepIndex ? next : s));
  const owned = ownedSteps(p, day.mode).map((k) => steps[k]);
  const done = owned.every((s) => s.status !== "open");
  const outcome: ProblemDay["outcome"] = !done ? null
    : owned.some((s) => s.status === "shown") ? "shown"
    : owned.every((s) => s.tries === 1 && !s.hint) ? "clean"
    : "solved";
  const updated: ProblemDay = { ...day, steps, done, outcome };
  return { ...state, problemDays: (state.problemDays ?? []).map((d) => (d.date === date ? updated : d)) };
}

/** The last `n` days ending at `date`, oldest first, with each day's outcome (null = no problem done). */
export function recentDays(state: LearnState, date: string, n = 7): { date: string; outcome: ProblemDay["outcome"]; done: boolean }[] {
  const map = new Map((state.problemDays ?? []).map((d) => [d.date, d]));
  return Array.from({ length: n }, (_, k) => {
    const d = addDays(date, k - n + 1);
    const day = map.get(d);
    return { date: d, outcome: day?.outcome ?? null, done: !!day?.done };
  });
}

// Everything the engine remembers about one student, as a plain JSON document, plus the
// pure rules that update it: lesson order, mastery, the scaffolding dial, wheel-spinning,
// resurfacing after 1/3/7 days, the daily set, the mistakes log and per-card logs.
// No I/O: guest mode keeps the document in localStorage, signed-in mode in Supabase.
import distribution from "../../../data/topic-distribution.json";
import { addDays } from "../dates";
import { applyMiss, applyTwinOutcome } from "../review";
import { smoothedAccuracy } from "../trainer";
import {
  MAX_LOGS, MAX_MINUTES_PER_CARD, MAX_STEP_LOGS, MAX_WRONG_MOVES_FOR_CREDIT, PARK_DAYS, QUICK_CARDS, RESURFACE_DAYS, WHEEL_SPIN_FAILURES, type Pacing,
} from "./config";
import { ALL_SKILLS, PACKS, generateCard, getCard, skillOf, topicOfSkill } from "./registry";
import type { Skill } from "./types";

export const ENGINE_VERSION = 1;
export type Level = 1 | 2 | 3;
export type Stage = "new" | "reps" | "twist" | "mastered";
export type Source = "lesson" | "review" | "new" | "stretch" | "quick";
export type Outcome = "solved" | "timeout" | "not_sure";
/** pass = solved with mastery credit · assisted = solved with a hint or too many wrong moves */
export type Result = "pass" | "assisted" | "timeout" | "not_sure";

export interface SkillProgress {
  stage: Stage;
  /** Easy reps passed with credit (3 unlock the twist). */
  reps: number;
  /** Misses in a row (wheel-spinning counter). */
  failures: number;
  parkedUntil: string | null;
  /** Show the worked example again before the next card. */
  reshow: boolean;
  introducedOn: string | null;
  masteredOn: string | null;
  lastSeen: string | null;
  /** Bumped for every generated card, so variants are never repeated. */
  seq: number;
  /** Support level the student ended the last card on (moves up after clean steps, down after errors). */
  level?: Level;
}

export interface QueueItem {
  id: string;
  skill: string;
  /** Whether the missed card was an easy rep or a twist. */
  kind: "rep" | "twist";
  originCard: string;
  stage: number; // index into RESURFACE_DAYS
  due: string;
  status: "pending" | "retired";
}

export interface Mistake {
  id: string;
  at: string;
  date: string;
  cardId: string;
  skill: string;
  topic: string;
  problem: string;
  userAnswer: string;
  correctAnswer: string;
  seconds: number;
  outcome: Outcome;
  /** The step that wasn't managed, e.g. "Step 2: Zero-product rule". */
  failedStep?: string;
  /** Every line on the student's workspace when the card ended. */
  workspace?: string[];
  /** One of ERROR_TYPES in src/lib/tags.ts; null until the student taps one. */
  errorType: string | null;
  note: string;
  /** "Next time I will…" from the weekly error review. */
  takeaway: string | null;
  reviewedOn: string | null;
}

export interface CardLog {
  at: string;
  date: string;
  cardId: string;
  topic: string;
  skill: string;
  type: "rep" | "twist";
  source: Source;
  level: Level;
  seconds: number;
  wrongMoves: number;
  hintLevel: number;
  result: Result;
  skippedKeyMove: boolean;
}

/** One step of one card, as performed. */
export interface StepRecord {
  /** Move that locked the step in (or the reference move that was never managed). */
  move: string;
  level: Level;
  seconds: number;
  wrongMoves: number;
  /** Highest hint rung used on this step (0 = none). */
  hintLevel: number;
  result: "ok" | "unfinished";
}
export interface StepLog extends StepRecord {
  at: string;
  date: string;
  cardId: string;
  topic: string;
  skill: string;
  index: number;
}

export interface Step {
  skill: string;
  cardId: string;
  type: "rep" | "twist";
  level: Level;
  source: Source;
  /** Show the skill's worked example before this card. */
  example: boolean;
  queueId?: string;
}
export interface DailySlot extends Step {
  kind: "review" | "new" | "stretch";
  done: boolean;
  result: Result | null;
}
export interface DailySet { date: string; slots: DailySlot[] }

export interface EngineProgress {
  v: typeof ENGINE_VERSION;
  /** Scaffolding dial: 0 = automatic, 1-3 = fixed level. */
  dial: 0 | Level;
  skills: Record<string, SkillProgress>;
  queue: QueueItem[];
  mistakes: Mistake[];
  logs: CardLog[];
  /** Per-step logs (topic, skill, level, time, wrong moves, hint level, result). */
  steps?: StepLog[];
  daily: DailySet | null;
}

export function emptyProgress(): EngineProgress {
  return { v: ENGINE_VERSION, dial: 0, skills: {}, queue: [], mistakes: [], logs: [], steps: [], daily: null };
}
export function isEngineProgress(x: unknown): x is EngineProgress {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return o.v === ENGINE_VERSION && typeof o.skills === "object" && o.skills !== null && ["queue", "mistakes", "logs"].every((k) => Array.isArray(o[k]));
}

let counter = 0;
const newId = () => `${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const FRESH: SkillProgress = { stage: "new", reps: 0, failures: 0, parkedUntil: null, reshow: false, introducedOn: null, masteredOn: null, lastSeen: null, seq: 0 };
export const skillState = (p: EngineProgress, id: string): SkillProgress => p.skills[id] ?? FRESH;
const withSkill = (p: EngineProgress, id: string, patch: Partial<SkillProgress>): EngineProgress => ({
  ...p,
  skills: { ...p.skills, [id]: { ...skillState(p, id), ...patch } },
});

export type Availability = "mastered" | "parked" | "locked" | "open";
/** A skill opens once the easy reps of every prerequisite are done. Mastery itself needs the twist. */
export function availability(p: EngineProgress, skill: Skill, today: string): Availability {
  const sp = skillState(p, skill.id);
  if (sp.stage === "mastered") return "mastered";
  if (skill.prereqs.some((id) => ["new", "reps"].includes(skillState(p, id).stage))) return "locked";
  if (sp.parkedUntil && sp.parkedUntil > today) return "parked";
  return "open";
}
/** The feed rule: an idea is eligible for quick retrieval only after it was worked in a lesson or daily set. */
export const introduced = (p: EngineProgress, id: string) => skillState(p, id).stage !== "new";

// ---- which card, at which level ---------------------------------------------------
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) % 100000;
}
const seen = (p: EngineProgress, cardId: string) => p.logs.some((l) => l.cardId === cardId);
/** A never-seen variant of a skill, also avoiding the ids in `avoid` (cards already planned today). */
function variant(p: EngineProgress, skillId: string, type: "rep" | "twist", avoid: ReadonlySet<string> = new Set()): string {
  const seed = hash(skillId) + skillState(p, skillId).seq * 13 + 1;
  let id = generateCard(skillId, type, seed).id;
  for (let i = 1; i < 40 && (seen(p, id) || avoid.has(id)); i++) id = generateCard(skillId, type, seed + i * 7).id;
  return id;
}

/**
 * Starting support level for a card. 1 = guided (highlight + kind of step), 2 = prompted
 * (goal of the step + the standing toolbox), 3 = open. The level then moves within the card
 * (up after clean steps, down after errors) and the card's end level is remembered per skill.
 */
export function levelFor(p: EngineProgress, skillId: string, type: "rep" | "twist", source: Source, pace: Pacing, queueStage = 0): Level {
  if (p.dial) return p.dial;
  const sp = skillState(p, skillId);
  // The first easy rep of a brand-new skill is always guided.
  const firstContact = (source === "lesson" || source === "new") && type === "rep" && sp.reps === 0 && !sp.level;
  if (firstContact) return 1;
  let level: Level;
  if (source === "review") level = queueStage === 0 ? 2 : 3;
  else if (source === "quick") level = sp.stage === "mastered" ? 3 : 2;
  else if (source === "stretch") level = type === "twist" ? 2 : 3;
  else if (type === "twist") level = 2;
  else level = sp.reps >= 2 ? 2 : 1;
  // What the student last earned on this skill wins over the default, in either direction,
  // except that a twist never starts guided: mastery needs it at Level 2 or 3.
  if (sp.level) level = sp.level;
  if (type === "twist" && level < 2) level = 2;
  return Math.max(level, pace.minLevel) as Level;
}

/** The next card of a skill's lesson: worked example + 3 easy reps, then the twist. Null once mastered. */
export function nextLessonStep(p: EngineProgress, skillId: string, pace: Pacing, source: Source = "lesson", avoid: ReadonlySet<string> = new Set()): Step | null {
  const skill = skillOf(skillId);
  const sp = skillState(p, skillId);
  if (!skill || sp.stage === "mastered") return null;
  const type = sp.stage === "twist" ? "twist" : "rep";
  const hand = type === "twist" ? skill.twist : skill.reps[Math.min(sp.reps, 2)];
  // A card that was already attempted is never repeated: a fresh variant takes its place.
  const cardId = seen(p, hand) || avoid.has(hand) ? variant(p, skillId, type, avoid) : hand;
  return { skill: skillId, cardId, type, level: levelFor(p, skillId, type, source, pace), source, example: sp.stage === "new" || sp.reshow };
}

// ---- recording a card ----------------------------------------------------------------
export interface CardOutcome {
  cardId: string;
  source: Source;
  level: Level;
  seconds: number;
  wrongMoves: number;
  hintLevel: number;
  outcome: Outcome;
  skippedKeyMove: boolean;
  problem: string;
  userAnswer: string;
  correctAnswer: string;
  queueId?: string;
  /** Every step as performed (and the one left unfinished). */
  steps?: StepRecord[];
  failedStep?: string;
  workspace?: string[];
  /** Support level when the card ended. */
  endLevel?: Level;
}
export type EngineEvent = "reps_done" | "mastered" | "parked";
export interface Recorded {
  progress: EngineProgress;
  result: Result;
  mistakeId: string | null;
  events: EngineEvent[];
}

export function markExampleSeen(p: EngineProgress, skillId: string, today: string): EngineProgress {
  const sp = skillState(p, skillId);
  return withSkill(p, skillId, { stage: sp.stage === "new" ? "reps" : sp.stage, reshow: false, introducedOn: sp.introducedOn ?? today });
}

export function recordCard(p0: EngineProgress, o: CardOutcome, today: string, now: Date = new Date()): Recorded {
  const card = getCard(o.cardId);
  if (!card || card.type === "worked") throw new Error(`Cannot record card ${o.cardId}`);
  const skillId = card.skill;
  const type = card.type;
  // Mastery credit: solved without hints and without too many rejected moves. A twist also
  // has to be finished at Level 2 or 3 (support may drop to Level 1 mid-card after errors).
  const finalLevel = o.endLevel ?? o.level;
  const credit = o.outcome === "solved" && o.hintLevel === 0 && o.wrongMoves <= MAX_WRONG_MOVES_FOR_CREDIT && (type !== "twist" || (o.level >= 2 && finalLevel >= 2));
  const result: Result = credit ? "pass" : o.outcome === "solved" ? "assisted" : o.outcome;
  const missed = o.outcome !== "solved";
  const events: EngineEvent[] = [];
  const sp = skillState(p0, skillId);

  // Skill: lesson progress, mastery, wheel-spinning.
  const next: SkillProgress = {
    ...sp,
    stage: sp.stage === "new" ? "reps" : sp.stage,
    introducedOn: sp.introducedOn ?? today,
    lastSeen: today,
    seq: sp.seq + (card.generated ? 1 : 0),
    level: p0.dial ? sp.level : (o.endLevel ?? sp.level),
  };
  if (credit) {
    next.failures = 0;
    if (type === "rep" && next.stage === "reps") {
      next.reps = Math.min(3, next.reps + 1);
      if (next.reps >= 3) {
        next.stage = "twist";
        events.push("reps_done");
      }
    } else if (type === "twist" && next.stage !== "mastered") {
      // Mastery needs the twist, not only the easy reps.
      next.stage = "mastered";
      next.masteredOn = today;
      next.parkedUntil = null;
      events.push("mastered");
    }
  } else if (missed) {
    next.failures = sp.failures + 1;
    if (next.failures >= WHEEL_SPIN_FAILURES) {
      next.failures = 0;
      next.reshow = true;
      next.parkedUntil = addDays(today, PARK_DAYS);
      events.push("parked");
    }
  }
  let p: EngineProgress = { ...p0, skills: { ...p0.skills, [skillId]: next } };

  // Resurfacing queue: one pending item per skill.
  const pending = p.queue.find((q) => q.skill === skillId && q.status === "pending");
  if (pending && o.source === "review" && o.queueId === pending.id) {
    const moved = applyTwinOutcome({ stage: pending.stage, dueDate: pending.due, status: pending.status }, { correct: credit, familiar: false }, today, RESURFACE_DAYS);
    p = { ...p, queue: p.queue.map((q) => (q.id === pending.id ? { ...q, stage: moved.stage, due: moved.dueDate, status: moved.status } : q)) };
  } else if (!credit) {
    // Missed, or solved only with help: the idea comes back as a fresh variant.
    const reset = applyMiss(null, today, RESURFACE_DAYS);
    p = pending
      ? { ...p, queue: p.queue.map((q) => (q.id === pending.id ? { ...q, stage: reset.stage, due: reset.dueDate, kind: type, originCard: o.cardId } : q)) }
      : { ...p, queue: [...p.queue, { id: newId(), skill: skillId, kind: type, originCard: o.cardId, stage: reset.stage, due: reset.dueDate, status: "pending" }] };
  }

  // Mistakes log.
  let mistakeId: string | null = null;
  if (missed) {
    mistakeId = newId();
    const m: Mistake = {
      id: mistakeId, at: now.toISOString(), date: today, cardId: o.cardId, skill: skillId, topic: topicOfSkill(skillId),
      problem: o.problem, userAnswer: o.userAnswer, correctAnswer: o.correctAnswer, seconds: Math.round(o.seconds), outcome: o.outcome,
      errorType: o.outcome === "timeout" ? "out_of_time" : null, note: "", takeaway: null, reviewedOn: null,
      failedStep: o.failedStep, workspace: o.workspace,
    };
    p = { ...p, mistakes: [...p.mistakes, m] };
  }

  // Per-card log, for tuning time budgets and thresholds.
  const log: CardLog = {
    at: now.toISOString(), date: today, cardId: o.cardId, topic: topicOfSkill(skillId), skill: skillId, type, source: o.source, level: o.level,
    seconds: Math.round(o.seconds), wrongMoves: o.wrongMoves, hintLevel: o.hintLevel, result, skippedKeyMove: o.skippedKeyMove,
  };
  p = { ...p, logs: [...p.logs, log].slice(-MAX_LOGS) };
  const stepLogs: StepLog[] = (o.steps ?? []).map((st, index) => ({
    ...st, at: now.toISOString(), date: today, cardId: o.cardId, topic: topicOfSkill(skillId), skill: skillId, index, seconds: Math.round(st.seconds * 10) / 10,
  }));
  p = { ...p, steps: [...(p.steps ?? []), ...stepLogs].slice(-MAX_STEP_LOGS) };

  // Daily set.
  if (p.daily?.date === today) {
    let marked = false;
    p = {
      ...p,
      daily: {
        ...p.daily,
        slots: p.daily.slots.map((s) => {
          if (marked || s.done || s.cardId !== o.cardId) return s;
          marked = true;
          return { ...s, done: true, result };
        }),
      },
    };
  }
  return { progress: p, result, mistakeId, events };
}

export function setMistakeDetails(p: EngineProgress, id: string, errorType: string, note: string): EngineProgress {
  return { ...p, mistakes: p.mistakes.map((m) => (m.id === id ? { ...m, errorType, note: note.trim().slice(0, 140) } : m)) };
}
export function setMistakeTakeaway(p: EngineProgress, id: string, takeaway: string, today: string): EngineProgress {
  return { ...p, mistakes: p.mistakes.map((m) => (m.id === id ? { ...m, takeaway: takeaway.trim(), reviewedOn: today } : m)) };
}

// ---- daily set: 1 review, 1 new concept, 1 stretch ---------------------------------------
const WEIGHTS: Record<string, number> = Object.fromEntries(Object.entries(distribution.topics).map(([t, x]) => [t, x.weight]));
export const topicWeight = (topic: string) => WEIGHTS[topic] ?? 0.05;

function topicAccuracy(p: EngineProgress): Map<string, number> {
  const stats = new Map<string, { attempts: number; correct: number }>();
  for (const l of p.logs.slice(-400)) {
    const s = stats.get(l.topic) ?? { attempts: 0, correct: 0 };
    s.attempts++;
    if (l.result === "pass") s.correct++;
    stats.set(l.topic, s);
  }
  return new Map([...stats].map(([t, s]) => [t, smoothedAccuracy(s)]));
}

const byLeastRecent = (p: EngineProgress) => (a: Skill, b: Skill) => (skillState(p, a.id).lastSeen ?? "").localeCompare(skillState(p, b.id).lastSeen ?? "");
const dueItems = (p: EngineProgress, today: string) =>
  p.queue.filter((q) => q.status === "pending" && q.due <= today).sort((a, b) => a.due.localeCompare(b.due) || a.id.localeCompare(b.id));

function reviewStep(p: EngineProgress, q: QueueItem, pace: Pacing, source: Source, avoid: ReadonlySet<string> = new Set(), repOnly = false): Step {
  const stage = skillState(p, q.skill).stage;
  const type = !repOnly && q.kind === "twist" && (stage === "twist" || stage === "mastered") ? "twist" : "rep";
  return { skill: q.skill, cardId: variant(p, q.skill, type, avoid), type, level: levelFor(p, q.skill, type, "review", pace, q.stage), source, example: false, queueId: q.id };
}

/** The skill the "new concept" slot works on: something in progress first, else the topic furthest below its target share. */
function nextNewSkill(p: EngineProgress, today: string, pace: Pacing): Skill | null {
  const open = ALL_SKILLS.filter((s) => availability(p, s, today) === "open");
  const inProgress = open.find((s) => introduced(p, s.id));
  if (inProgress) return inProgress;
  if (!pace.allowNew || !open.length) return null;
  const started = ALL_SKILLS.filter((s) => introduced(p, s.id));
  const totalWeight = PACKS.reduce((sum, pack) => sum + topicWeight(pack.topic), 0);
  const deficit = (s: Skill) => {
    const topic = topicOfSkill(s.id);
    const have = started.length ? started.filter((x) => topicOfSkill(x.id) === topic).length / started.length : 0;
    return topicWeight(topic) / totalWeight - have;
  };
  return [...open].sort((a, b) => deficit(b) - deficit(a) || ALL_SKILLS.indexOf(a) - ALL_SKILLS.indexOf(b))[0];
}

export function buildDailySet(p: EngineProgress, today: string, pace: Pacing): DailySet {
  const slots: DailySlot[] = [];
  const used = new Set<string>();
  const push = (kind: DailySlot["kind"], step: Step) => {
    if (used.has(step.cardId)) return;
    used.add(step.cardId);
    slots.push({ ...step, kind, source: kind, done: false, result: null });
  };

  // 1. Review: the oldest due item from the mistakes queue, else an earlier skill mixed back in (interleaving).
  const newSkill = nextNewSkill(p, today, pace);
  const due = dueItems(p, today).find((q) => { const s = skillOf(q.skill); return s && availability(p, s, today) !== "parked"; });
  if (due) push("review", reviewStep(p, due, pace, "review", used));
  else {
    const earlier = ALL_SKILLS.filter((s) => introduced(p, s.id) && availability(p, s, today) !== "parked" && s.id !== newSkill?.id).sort(byLeastRecent(p))[0];
    if (earlier) push("review", { skill: earlier.id, cardId: variant(p, earlier.id, "rep", used), type: "rep", level: levelFor(p, earlier.id, "rep", "quick", pace), source: "review", example: false });
  }

  // 2. New concept: the next lesson step.
  const lesson = newSkill ? nextLessonStep(p, newSkill.id, pace, "new", used) : null;
  if (lesson) push("new", lesson);

  // 3. Stretch: from the weakest topic, a twist if one is unlocked, else a harder-scaffolded rep.
  const acc = topicAccuracy(p);
  const candidates = ALL_SKILLS.filter((s) => introduced(p, s.id) && availability(p, s, today) !== "parked");
  const weakest = [...new Set(candidates.map((s) => topicOfSkill(s.id)))].sort((a, b) => (acc.get(a) ?? 0.5) - (acc.get(b) ?? 0.5) || topicWeight(b) - topicWeight(a))[0];
  const inTopic = candidates.filter((s) => topicOfSkill(s.id) === weakest);
  const twistReady = inTopic.find((s) => skillState(p, s.id).stage === "twist" && s.id !== lesson?.skill);
  if (twistReady) {
    const cardId = seen(p, twistReady.twist) || used.has(twistReady.twist) ? variant(p, twistReady.id, "twist", used) : twistReady.twist;
    push("stretch", { skill: twistReady.id, cardId, type: "twist", level: levelFor(p, twistReady.id, "twist", "stretch", pace), source: "stretch", example: false });
  } else {
    const s = inTopic.filter((x) => x.id !== lesson?.skill).sort(byLeastRecent(p))[0] ?? inTopic[0];
    if (s) push("stretch", { skill: s.id, cardId: variant(p, s.id, "rep", used), type: "rep", level: levelFor(p, s.id, "rep", "stretch", pace), source: "stretch", example: false });
  }

  // Early days have nothing to review or stretch yet: fill with the next easy reps of the new skill.
  if (lesson && lesson.type === "rep") {
    const skill = skillOf(lesson.skill)!;
    for (const cardId of skill.reps) {
      if (slots.length >= 3) break;
      if (!seen(p, cardId)) push("new", { ...lesson, cardId, example: false });
    }
  }
  const order = { review: 0, new: 1, stretch: 2 } as const;
  return { date: today, slots: slots.slice(0, 3).sort((a, b) => order[a.kind] - order[b.kind]) };
}

/** Today's set, built once per day. */
export function ensureDailySet(p: EngineProgress, today: string, pace: Pacing): EngineProgress {
  return p.daily?.date === today ? p : { ...p, daily: buildDailySet(p, today, pace) };
}
export function dailyStatus(p: EngineProgress, today: string) {
  const slots = p.daily?.date === today ? p.daily.slots : [];
  const done = slots.filter((s) => s.done).length;
  return { total: slots.length, done, complete: slots.length > 0 && done === slots.length };
}
/** Minutes of engine work on a date, for the day's activity row. */
export function minutesOn(p: EngineProgress, date: string): number {
  const total = p.logs.filter((l) => l.date === date).reduce((sum, l) => sum + Math.min(l.seconds / 60, MAX_MINUTES_PER_CARD), 0);
  return Math.round(total * 10) / 10;
}

/** Quick reps (the 90-second mode): retrieval only, and only from ideas already worked. */
export function quickSteps(p: EngineProgress, today: string, pace: Pacing, count = QUICK_CARDS): Step[] {
  const eligible = ALL_SKILLS.filter((s) => introduced(p, s.id) && availability(p, s, today) !== "parked");
  if (!eligible.length) return [];
  const steps: Step[] = [];
  const used = new Set<string>();
  const add = (step: Step) => {
    used.add(step.cardId);
    steps.push(step);
  };
  for (const q of dueItems(p, today)) {
    if (steps.length >= count || !eligible.some((s) => s.id === q.skill) || steps.some((s) => s.skill === q.skill)) continue;
    add(reviewStep(p, q, pace, "review", used, true));
  }
  const rest = [...eligible].sort(byLeastRecent(p));
  for (let i = 0; steps.length < count && i < count * 3; i++) {
    const s = rest[i % rest.length];
    add({ skill: s.id, cardId: variant(p, s.id, "rep", used), type: "rep", level: levelFor(p, s.id, "rep", "quick", pace), source: "quick", example: false });
  }
  return steps;
}

/** Misses still waiting for a "next time I will…" takeaway. */
export const unreviewedMistakes = (p: EngineProgress) => p.mistakes.filter((m) => !m.takeaway);

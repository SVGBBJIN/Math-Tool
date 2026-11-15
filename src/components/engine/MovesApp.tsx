"use client";
// The Moves tab: today's set, quick reps, the scaffolding dial and the skill tree, plus the
// session that runs cards one after another. Storage-agnostic: the page passes in the
// student's progress document and a `save` function (browser for guests, Supabase otherwise).
import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { isTimed, pacing, timeBudget, type Pacing } from "@/lib/engine/config";
import {
  availability, dailyStatus, ensureDailySet, markExampleSeen, minutesOn, nextLessonStep, quickSteps, recordCard, setMistakeDetails, skillState,
  type EngineEvent, type EngineProgress, type Level, type Result, type Step,
} from "@/lib/engine/progress";
import { PACKS, getCard, moduleOf, skillOf, type Card } from "@/lib/engine/registry";
import { problemText } from "@/lib/engine/ui";
import { CardRunner, type RunResult } from "./CardRunner";
import { Reveal, WorkedExample } from "./Panels";

type Mode = { kind: "daily" } | { kind: "quick"; steps: Step[] } | { kind: "lesson"; skill: string };

const SOURCE_LABEL: Record<Step["source"], string> = { review: "Review", new: "New concept", stretch: "Stretch", quick: "Quick rep", lesson: "Lesson" };
const PHASE_TEXT: Record<Pacing["phase"], string> = {
  foundation: "building foundations",
  build: "building: less scaffolding",
  sharpen: "sharpening: tighter timers",
  taper: "final week: review only, nothing new",
};

export function MovesApp({
  initial, today, contestDate, save, basePath = "", readOnly = false,
}: {
  initial: EngineProgress; today: string; contestDate: string | null; save: (p: EngineProgress) => void; basePath?: string; readOnly?: boolean;
}) {
  const pace = useMemo(() => pacing(today, contestDate), [today, contestDate]);
  const [progress, setProgress] = useState(() => (readOnly ? initial : ensureDailySet(initial, today, pace)));
  const latest = useRef(progress);
  const [mode, setMode] = useState<Mode | null>(null);

  const commit = useCallback(
    (next: EngineProgress) => {
      latest.current = next;
      setProgress(next);
      save(next);
    },
    [save],
  );

  if (mode) return <Session mode={mode} latest={latest} commit={commit} today={today} pace={pace} onExit={() => setMode(null)} />;

  const daily = dailyStatus(progress, today);
  const slots = progress.daily?.date === today ? progress.daily.slots : [];
  const quick = readOnly ? [] : quickSteps(progress, today, pace);
  const cardsToday = progress.logs.filter((l) => l.date === today).length;
  const settings = `${basePath}/settings`;

  return (
    <div className="space-y-4 md:space-y-6">
      <section className="card">
        <h1 className="h2">Moves</h1>
        <p className="text-sm text-muted">Solve on the workspace, step by step: drag the pieces, the app checks every step by computation. No paper needed.</p>
        <p className="mt-2 text-xs text-muted">
          {pace.daysLeft === null ? (
            <>Contest date not set, so pacing uses the gentlest ramp. <Link href={settings} className="font-semibold text-brand">Set it in Settings →</Link></>
          ) : pace.daysLeft < 0 ? (
            <>The contest date has passed. <Link href={settings} className="font-semibold text-brand">Update it →</Link></>
          ) : (
            <>{pace.daysLeft} days to the contest · {PHASE_TEXT[pace.phase]}</>
          )}
        </p>
      </section>

      <section className="card">
        <div className="flex items-baseline justify-between">
          <h2 className="h2">Today&apos;s set</h2>
          <span className="text-sm text-muted">{daily.done} / {daily.total}</span>
        </div>
        {slots.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{readOnly ? "No set has been started today." : "Nothing is scheduled today. Pick a skill below."}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {slots.map((s, i) => (
              <li key={i} className={`flex items-center gap-3 rounded-xl border p-3 ${s.done ? "border-mastery/40 bg-mastery/5" : "border-line"}`}>
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-bold ${s.done ? "bg-mastery text-white" : "border-2 border-line"}`} aria-hidden>{s.done ? "✓" : ""}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{SOURCE_LABEL[s.kind]}</p>
                  {/* The skill name would give the method away for a review or stretch card. */}
                  <p className="text-xs text-muted">{s.kind === "new" || s.done ? skillOf(s.skill)?.title : "from an earlier idea"}{s.done && s.result ? ` · ${s.result.replace("_", " ")}` : ""}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
        {!readOnly && slots.length > 0 && !daily.complete && (
          <button type="button" className="btn mt-3 w-full" onClick={() => setMode({ kind: "daily" })}>{daily.done ? "Continue" : "Start"} · about {Math.max(1, Math.round((slots.length - daily.done) * 0.75))} min</button>
        )}
        {daily.complete && <p className="mt-3 text-sm font-semibold text-mastery">Set done for today ✓</p>}
        <p className="mt-2 text-xs text-muted">{cardsToday} card{cardsToday === 1 ? "" : "s"} · {minutesOn(progress, today)} min of moves today</p>
      </section>

      {!readOnly && (
        <section className="card">
          <h2 className="h2">Quick reps · 90 seconds</h2>
          <p className="text-sm text-muted">No paper needed. Three fast cards from ideas you have already learned.</p>
          {quick.length ? (
            <button type="button" className="btn-ghost mt-3 w-full" onClick={() => setMode({ kind: "quick", steps: quick })}>Start quick reps</button>
          ) : (
            <p className="mt-2 text-sm text-muted">Quick reps only use ideas you&apos;ve already worked. Start today&apos;s set or a lesson first.</p>
          )}
        </section>
      )}

      {!readOnly && (
        <section className="card">
          <h2 className="h2">Scaffolding</h2>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {([0, 1, 2, 3] as const).map((d) => (
              <button key={d} type="button" aria-pressed={progress.dial === d} onClick={() => commit({ ...progress, dial: d })}
                className={`min-h-11 rounded-xl border-2 text-sm font-semibold ${progress.dial === d ? "border-brand bg-brand/10 text-brand" : "border-line"}`}>
                {d === 0 ? "Auto" : `Level ${d}`}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">1: the next step is highlighted and named · 2: you get only the goal of each step · 3: a blank workspace and the problem&apos;s goal. Auto moves up after clean steps and down after repeated errors.</p>
        </section>
      )}

      {PACKS.map((pack) => (
        <section key={pack.id} className="card">
          <h2 className="h2">{pack.title}</h2>
          <ul className="mt-3 space-y-2">
            {pack.skills.map((s) => {
              const sp = skillState(progress, s.id);
              const a = availability(progress, s, today);
              const status =
                a === "mastered" ? "Mastered ✓"
                : a === "locked" ? `Locked: finish ${s.prereqs.filter((id) => ["new", "reps"].includes(skillState(progress, id).stage)).map((id) => skillOf(id)?.title).join(", ")}`
                : a === "parked" ? `Parked until ${sp.parkedUntil}: we'll come back to it`
                : sp.stage === "twist" ? "Easy reps done · twist next"
                : sp.stage === "reps" ? `Easy reps ${sp.reps} / 3`
                : "New";
              return (
                <li key={s.id} className={`flex items-center gap-3 rounded-xl border p-3 ${a === "mastered" ? "border-mastery/40 bg-mastery/5" : a === "locked" ? "border-line opacity-60" : "border-line"}`}>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{s.title}</p>
                    <p className="text-xs text-muted">{s.blurb}</p>
                    <p className={`text-xs font-semibold ${a === "mastered" ? "text-mastery" : a === "parked" ? "text-familiar" : "text-muted"}`}>{status}</p>
                  </div>
                  {!readOnly && a === "open" && (
                    <button type="button" className="btn-ghost shrink-0 text-sm" onClick={() => setMode({ kind: "lesson", skill: s.id })}>{sp.stage === "new" ? "Learn" : "Continue"}</button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------------------
type Phase =
  | { at: "example"; step: Step }
  | { at: "card"; step: Step }
  | { at: "reveal"; step: Step; card: Card; run: RunResult; result: Result; mistakeId: string | null; events: EngineEvent[] }
  | { at: "parked"; skill: string }
  | { at: "done" };

function Session({
  mode, latest, commit, today, pace, onExit,
}: {
  mode: Mode; latest: React.RefObject<EngineProgress>; commit: (p: EngineProgress) => void; today: string; pace: Pacing; onExit: () => void;
}) {
  const index = useRef(0);
  const tally = useRef({ cards: 0, passed: 0 });

  const nextStep = useCallback((): Step | null => {
    const p = latest.current;
    if (mode.kind === "daily") return (p.daily?.date === today ? p.daily.slots.find((s) => !s.done) : null) ?? null;
    if (mode.kind === "quick") return mode.steps[index.current] ?? null;
    const skill = skillOf(mode.skill);
    return skill && availability(p, skill, today) === "open" ? nextLessonStep(p, mode.skill, pace) : null;
  }, [latest, mode, pace, today]);

  const enter = (step: Step | null): Phase => (!step ? { at: "done" } : step.example ? { at: "example", step } : { at: "card", step });
  const [phase, setPhase] = useState<Phase>(() => enter(nextStep()));

  const exit = <button type="button" className="text-sm font-semibold text-muted" onClick={onExit}>← Back to Moves</button>;

  if (phase.at === "done") {
    const mastered = mode.kind === "lesson" && skillState(latest.current, mode.skill).stage === "mastered";
    return (
      <div className="card text-center">
        <h1 className="h1">{mastered ? "Skill mastered" : mode.kind === "daily" ? "Set done" : mode.kind === "quick" ? "Quick reps done" : "That's it for now"}</h1>
        <p className="mt-1 text-muted">
          {tally.current.cards ? `${tally.current.passed} of ${tally.current.cards} passed cleanly. ` : ""}
          Anything missed comes back with new numbers after 1, 3 and 7 days.
        </p>
        <button type="button" className="btn mt-4" onClick={onExit}>Back to Moves</button>
      </div>
    );
  }

  if (phase.at === "parked") {
    const skill = skillOf(phase.skill)!;
    const card = getCard(skill.worked)!;
    return (
      <div className="space-y-3">
        {exit}
        <p className="card border-familiar/50 text-sm">Three misses in a row on this idea. That&apos;s a signal to step back, not to push harder: read the example once more, then we&apos;ll move on and return to it in a couple of days.</p>
        <WorkedExample card={card} title={skill.title} again onDone={() => {
          commit(markExampleSeen(latest.current, phase.skill, today));
          setPhase(mode.kind === "lesson" ? { at: "done" } : enter(nextStep()));
        }} />
      </div>
    );
  }

  const step = phase.step;
  const skill = skillOf(step.skill)!;

  if (phase.at === "example") {
    return (
      <div className="space-y-3">
        {exit}
        <WorkedExample card={getCard(skill.worked)!} title={skill.title} again={skillState(latest.current, step.skill).reshow} onDone={() => {
          commit(markExampleSeen(latest.current, step.skill, today));
          setPhase({ at: "card", step: { ...step, example: false } });
        }} />
      </div>
    );
  }

  const card = getCard(step.cardId);
  if (!card) {
    return <div className="card space-y-3"><p className="text-muted">This card is no longer available.</p><button type="button" className="btn" onClick={onExit}>Back to Moves</button></div>;
  }

  if (phase.at === "card") {
    return (
      <div className="space-y-3">
        {exit}
        <CardRunner
          key={step.cardId}
          card={card}
          level={step.level as Level}
          budget={timeBudget(card, pace)}
          timed={isTimed(step.source)}
          adaptive={latest.current.dial === 0}
          label={`${SOURCE_LABEL[step.source]}${card.type === "twist" ? " · twist" : ""}`}
          onFinish={(run) => {
            const rec = recordCard(latest.current, {
              cardId: card.id, source: step.source, level: step.level, seconds: run.seconds, wrongMoves: run.wrongMoves, hintLevel: run.hintLevel,
              outcome: run.outcome, skippedKeyMove: run.skippedKeyMove, problem: problemText(card), userAnswer: run.userAnswer,
              correctAnswer: moduleOf(card).answer(card), queueId: step.queueId,
              steps: run.steps, failedStep: run.failedStep, workspace: run.workspace, endLevel: run.endLevel,
            }, today);
            commit(rec.progress);
            index.current++;
            tally.current.cards++;
            if (rec.result === "pass") tally.current.passed++;
            setPhase({ at: "reveal", step, card, run, result: rec.result, mistakeId: rec.mistakeId, events: rec.events });
          }}
        />
      </div>
    );
  }

  const messages = [
    ...(phase.events.includes("reps_done") ? ["Easy reps done. The twist is next: that's what earns mastery."] : []),
    ...(phase.events.includes("mastered") ? [`${skill.title}: mastered.`] : []),
  ];
  return (
    <div className="space-y-3">
      {exit}
      <Reveal key={phase.card.id} card={phase.card} result={phase.result} run={phase.run} messages={messages} isMistake={!!phase.mistakeId} onNext={(errorType, note) => {
        if (phase.mistakeId && errorType) commit(setMistakeDetails(latest.current, phase.mistakeId, errorType, note));
        if (phase.events.includes("parked")) return setPhase({ at: "parked", skill: step.skill });
        setPhase(enter(nextStep()));
      }} />
    </div>
  );
}

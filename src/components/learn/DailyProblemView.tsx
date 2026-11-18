"use client";
// The Daily Problem, Khan Academy style: the problem stays on screen and is solved one small
// step at a time. Each step has its own answer box, a hint, and "Show me this step". Steps
// unlock in order. On "part" days the earlier steps are worked for you and you solve the key
// step; the rest of the solution is then shown.
import { useEffect, useMemo, useState } from "react";
import {
  DOMAIN_NAME, checkStep, modeFor, ensureDailyProblem, getProblem, letter, ownedSteps, problemDayOf, recentDays, recordStep,
  type Problem, type ProblemDay, type Step, type StepAnswer, type StepEvent,
} from "@/lib/learn/problems";
import { addDays } from "@/lib/dates";
import { FigureView } from "./FigureView";
import { Rich } from "./Rich";
import type { LearnStore } from "./useLearnStore";

/** A number as markup: fractions as a stacked fraction. */
const valueTex = (v: string) => (v.includes("/") ? `$\\frac{${v.split("/")[0]}}{${v.split("/")[1]}}$` : `$${v}$`);

/** Each domain's color, and the color its gradients run to. */
const DOM_COLOR = { alg: "var(--color-alg)", nt: "var(--color-nt)", cp: "var(--color-cp)", geo: "var(--color-geo)" } as const;
const DOM_COLOR_2 = { alg: "#c026d3", nt: "#0e7490", cp: "#be185d", geo: "#6d28d9" } as const;
const CONFETTI = ["var(--color-brand)", "var(--color-violet)", "var(--color-pink)", "var(--color-sun)", "var(--color-mastery)", "var(--color-sky)"];

type View = "given" | "active" | "solved" | "shown" | "after" | "hidden";

/** How each step should appear right now. */
function stepViews(p: Problem, day: ProblemDay): View[] {
  const owned = new Set(ownedSteps(p, day.mode));
  const firstOpen = p.steps.findIndex((_, k) => owned.has(k) && day.steps[k].status === "open");
  return p.steps.map((_, k) => {
    if (owned.has(k)) {
      const st = day.steps[k].status;
      if (st === "solved") return "solved";
      if (st === "shown") return "shown";
      return k === firstOpen ? "active" : "hidden";
    }
    // Part day: steps before the key step are worked for you; the rest appear once it is done.
    return k < p.part ? "given" : day.done ? "after" : "hidden";
  });
}

export function DailyProblemView({ store, today }: { store: LearnStore; today: string }) {
  const { state, update } = store;
  useEffect(() => { update((s) => ensureDailyProblem(s, today)); }, [update, today]);
  const day = problemDayOf(state, today);
  const p = day ? getProblem(day.problemId) : null;
  const week = useMemo(() => recentDays(state, today, 7), [state, today]);
  if (!day || !p) return null;

  const views = stepViews(p, day);
  const color = DOM_COLOR[p.domain];
  const record = (k: number, ev: StepEvent) => update((s) => recordStep(s, today, k, ev));
  const owned = ownedSteps(p, day.mode);
  const solvedCount = owned.filter((k) => day.steps[k].status === "solved").length;

  return (
    <section className="problem-card card-in" style={{ ["--dom" as string]: color, ["--dom2" as string]: DOM_COLOR_2[p.domain] }} aria-labelledby="daily-problem-title">
      <div className="problem-band">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-white/20 px-2.5 py-1 text-xs font-bold uppercase tracking-wide">Daily Problem</span>
          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold uppercase tracking-wide" style={{ color }}>
            {day.mode === "full" ? "Full solve" : "Solve one part"}
          </span>
          <span className="ml-auto flex items-center gap-1" aria-label={`Difficulty ${p.difficulty} of 5`} title={`Difficulty ${p.difficulty} of 5`}>
            {Array.from({ length: 5 }, (_, k) => <span key={k} className={`h-2 w-2 rounded-full ${k < p.difficulty ? "bg-white" : "bg-white/30"}`} />)}
          </span>
        </div>
        <p className="mt-3 text-sm font-semibold text-white/85">{DOMAIN_NAME[p.domain]}</p>
        <h2 id="daily-problem-title" className="text-xl font-extrabold tracking-tight md:text-2xl">{p.title}</h2>
        <p className="mt-1 text-sm text-white/85">
          {day.mode === "full"
            ? `Work through it one step at a time: ${p.steps.length} steps.`
            : p.part === 0
              ? "Step 1 is the key step, and it's yours. The rest of the solution follows."
              : `Step${p.part === 1 ? " 1 is" : `s 1–${p.part} are`} worked for you. Step ${p.part + 1} is the key step, and it's yours.`}
        </p>
      </div>

      <div className="space-y-4 p-5 md:p-8">
        <div className="rounded-2xl border-l-4 bg-paper p-4 md:p-5" style={{ borderColor: color }}>
          <p className="prose-card"><Rich text={p.statement} /></p>
          {p.figure && <FigureView figure={p.figure} />}
        </div>

        <StepDots p={p} day={day} views={views} />

        <ol className="space-y-3">
          {p.steps.map((s, k) => views[k] === "hidden" ? null : (
            <li key={k}>
              {views[k] === "active"
                ? <ActiveStep key={`${day.date}-${k}`} step={s} index={k} total={p.steps.length} hinted={day.steps[k].hint} tries={day.steps[k].tries} onEvent={(ev) => record(k, ev)} />
                : <DoneStep step={s} index={k} view={views[k]} tries={day.steps[k].tries} hinted={day.steps[k].hint} />}
            </li>
          ))}
        </ol>

        {day.done && <Finished p={p} day={day} solved={solvedCount} total={owned.length} week={week} today={today} />}
      </div>
    </section>
  );
}

function StepDots({ p, day, views }: { p: Problem; day: ProblemDay; views: View[] }) {
  return (
    <div className="flex items-center gap-1.5" aria-label="Steps">
      {p.steps.map((_, k) => {
        const v = views[k];
        const cls =
          v === "solved" ? (day.steps[k].tries === 1 && !day.steps[k].hint ? "bg-mastery text-white" : "bg-apply text-white")
          : v === "shown" ? "bg-sun text-white"
          : v === "active" ? "pulse-ring bg-[var(--dom)] text-white"
          : v === "given" || v === "after" ? "bg-[color-mix(in_srgb,var(--dom)_18%,white)] text-[var(--dom)]"
          : "bg-canvas text-muted ring-1 ring-line";
        const label = v === "solved" ? "solved" : v === "shown" ? "shown" : v === "active" ? "current" : v === "given" || v === "after" ? "worked for you" : "to come";
        return (
          <span key={k} className="flex flex-1 items-center gap-1.5">
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${cls}`} title={`Step ${k + 1}: ${label}`}>
              {v === "solved" ? "✓" : k + 1}
            </span>
            {k < p.steps.length - 1 && <span className={`h-1 flex-1 rounded-full ${v === "solved" || v === "shown" || v === "given" || v === "after" ? "bg-[color-mix(in_srgb,var(--dom)_35%,white)]" : "bg-line"}`} />}
          </span>
        );
      })}
    </div>
  );
}

const emptyAnswer = (s: Step): StepAnswer =>
  s.input.kind === "numeric" ? { kind: "numeric", text: "" } : s.input.kind === "choice" ? { kind: "choice", id: "" } : { kind: "amc", index: -1 };
const hasAnswer = (a: StepAnswer) => (a.kind === "numeric" ? a.text.trim() !== "" : a.kind === "choice" ? a.id !== "" : a.index >= 0);

function ActiveStep({ step, index, total, hinted, tries, onEvent }: {
  step: Step; index: number; total: number; hinted: boolean; tries: number; onEvent: (ev: StepEvent) => void;
}) {
  const [answer, setAnswer] = useState<StepAnswer>(() => emptyAnswer(step));
  const [msg, setMsg] = useState<{ tone: "wrong" | "invalid"; text: string } | null>(null);
  const [wrongPicks, setWrongPicks] = useState<(string | number)[]>([]);
  const final = index === total - 1;

  const submit = () => {
    if (!hasAnswer(answer)) return;
    const r = checkStep(step, answer);
    if (r.status === "invalid") return setMsg({ tone: "invalid", text: r.message });
    onEvent({ type: "attempt", correct: r.status === "correct" });
    if (r.status === "incorrect") {
      setMsg({ tone: "wrong", text: r.message || "Not quite. Try again, or take the hint." });
      if (answer.kind === "choice") setWrongPicks((w) => [...w, answer.id]);
      if (answer.kind === "amc") setWrongPicks((w) => [...w, answer.index]);
    }
  };
  const i = step.input;

  return (
    <div className="step-panel card-in border-[var(--dom)] bg-[color-mix(in_srgb,var(--dom)_4%,white)]">
      <p className="text-xs font-bold uppercase tracking-wide text-[var(--dom)]">{final ? "Final answer" : `Step ${index + 1} of ${total}`}</p>
      <p className="prose-card mt-1"><Rich text={step.prompt} /></p>

      <div className="mt-3">
        {i.kind === "numeric" && (
          <div className="flex items-center gap-3">
            <input className="answer-input max-w-56 focus:!border-[var(--dom)]" inputMode="text" autoComplete="off" spellCheck={false} aria-label={`Answer for step ${index + 1}`} placeholder="Answer"
              value={(answer as { text: string }).text} onChange={(e) => { setAnswer({ kind: "numeric", text: e.target.value }); setMsg(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }} />
            {i.unit && <span className="text-lg text-muted">{i.unit}</span>}
          </div>
        )}
        {i.kind === "choice" && (
          <div role="radiogroup" className="space-y-2">
            {i.options.map((o) => {
              const on = answer.kind === "choice" && answer.id === o.id;
              const ruledOut = wrongPicks.includes(o.id);
              return (
                <button key={o.id} type="button" role="radio" aria-checked={on} disabled={ruledOut}
                  className={`option ${on ? "!border-[var(--dom)] !bg-[color-mix(in_srgb,var(--dom)_8%,white)]" : ""} ${ruledOut ? "line-through opacity-50" : ""}`}
                  onClick={() => { setAnswer({ kind: "choice", id: o.id }); setMsg(null); }}>
                  <span className={`h-4 w-4 shrink-0 rounded-full border-2 ${on ? "border-[var(--dom)] bg-[var(--dom)]" : "border-line"}`} aria-hidden />
                  <Rich text={o.text} />
                </button>
              );
            })}
          </div>
        )}
        {i.kind === "amc" && (
          <div role="radiogroup" className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {i.values.map((v, k) => {
              const on = answer.kind === "amc" && answer.index === k;
              const ruledOut = wrongPicks.includes(k);
              return (
                <button key={k} type="button" role="radio" aria-checked={on} disabled={ruledOut}
                  className={`amc-choice ${ruledOut ? "line-through opacity-40" : ""}`}
                  onClick={() => { setAnswer({ kind: "amc", index: k }); setMsg(null); }}>
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${on ? "bg-[var(--dom)] text-white" : "bg-canvas text-muted"}`}>{letter(k)}</span>
                  <span className="prose-card"><Rich text={valueTex(v)} /></span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {msg && (
        <p className={`callout mt-3 text-[15px] ${msg.tone === "wrong" ? "border border-pink/30 bg-pink/5" : "bg-canvas"}`} role="alert">
          {msg.tone === "wrong" && <span className="font-semibold text-pink">Not quite. </span>}
          <Rich text={msg.text.replace(/^Not quite\.\s*/, "")} />
        </p>
      )}
      {hinted && (
        <p className="callout mt-3 bg-sun/10 text-[15px]"><span className="font-semibold text-[#9a6700]">Hint: </span><Rich text={step.hint} /></p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" className="btn min-w-28" style={{ backgroundImage: "linear-gradient(135deg, var(--dom), var(--dom2))" }} disabled={!hasAnswer(answer)} onClick={submit}>
          {tries > 0 ? "Check again" : "Check"}
        </button>
        {!hinted && <button type="button" className="btn-ghost" onClick={() => onEvent({ type: "hint" })}>Hint</button>}
        <button type="button" className="ml-auto text-sm font-semibold text-muted hover:text-ink" onClick={() => onEvent({ type: "show" })}>Show me this step</button>
      </div>
    </div>
  );
}

function answerMarkup(step: Step): string {
  const i = step.input;
  if (i.kind === "numeric") return valueTex(i.answer);
  if (i.kind === "choice") return i.options.find((o) => o.id === i.answer)?.text ?? "";
  return `(${letter(i.answer)}) ${valueTex(i.values[i.answer])}`;
}

function DoneStep({ step, index, view, tries, hinted }: { step: Step; index: number; view: View; tries: number; hinted: boolean }) {
  const worked = view === "given" || view === "after";
  const tone =
    view === "solved" ? "border-mastery/40 bg-mastery/5"
    : view === "shown" ? "border-sun/40 bg-sun/5"
    : "border-transparent bg-[color-mix(in_srgb,var(--dom)_6%,white)]";
  const tag =
    view === "solved" ? (tries === 1 && !hinted ? "Solved first try" : "Solved")
    : view === "shown" ? "Shown"
    : "Worked for you";
  const tagCls = view === "solved" ? "bg-mastery text-white" : view === "shown" ? "bg-sun text-white" : "bg-white text-[var(--dom)]";
  return (
    <div className={`step-panel card-in ${tone}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-muted">Step {index + 1}</span>
        <span className={`pop rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${tagCls}`}>{tag}</span>
      </div>
      <p className={`mt-1 text-[15px] ${worked ? "text-muted" : ""}`}><Rich text={step.prompt} /></p>
      <p className="mt-2 text-[15px]">
        <span className="font-semibold">Answer: </span><Rich text={answerMarkup(step)} />
      </p>
      <p className="mt-1 text-[15px] text-ink/80"><Rich text={step.solution} /></p>
    </div>
  );
}

function Finished({ p, day, solved, total, week, today }: {
  p: Problem; day: ProblemDay; solved: number; total: number; week: ReturnType<typeof recentDays>; today: string;
}) {
  const headline = day.outcome === "clean" ? "Clean solve!" : day.outcome === "solved" ? "Solved!" : "Done for today";
  const sub =
    day.outcome === "clean" ? (total > 1 ? `All ${total} steps right on the first try, no hints.` : "Right on the first try, no hints.")
    : day.outcome === "solved" ? "You got there. Retries and hints are how this sticks."
    : `You saw how ${total > 1 ? "some steps go" : "the key step goes"}. A similar idea will come back on another day.`;
  return (
    <div className="relative overflow-hidden rounded-3xl p-5 text-white md:p-6" style={{ backgroundImage: "linear-gradient(135deg, var(--dom), var(--dom2))" }}>
      {day.outcome !== "shown" && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-0" aria-hidden>
          {Array.from({ length: 16 }, (_, k) => (
            <span key={k} className="confetti absolute block h-2 w-1.5 rounded-sm" style={{ left: `${(k * 61) % 100}%`, background: CONFETTI[k % CONFETTI.length], animationDelay: `${(k % 5) * 90}ms` }} />
          ))}
        </div>
      )}
      <p className="pop text-2xl font-extrabold tracking-tight">{headline}</p>
      <p className="mt-1 text-white/90">{sub}</p>
      {total > 1 && <p className="mt-1 text-sm text-white/75">{solved} of {total} steps solved on your own.</p>}
      <div className="mt-4 rounded-2xl bg-white/15 px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-wide text-white/70">Remember</p>
        <p className="mt-1 font-semibold leading-snug"><Rich text={p.takeaway} /></p>
      </div>
      <div className="mt-4">
        <p className="text-xs font-bold uppercase tracking-wide text-white/70">Your last 7 days</p>
        <div className="mt-2 flex gap-1.5">
          {week.map((d) => (
            <span key={d.date} title={`${d.date}: ${d.outcome ?? "no problem"}`}
              className={`flex h-8 flex-1 items-center justify-center rounded-lg text-[11px] font-bold ${d.outcome === "clean" ? "bg-white text-apply" : d.outcome === "solved" ? "bg-white/80 text-violet" : d.outcome === "shown" ? "bg-sun/90 text-white" : "bg-white/15 text-white/60"} ${d.date === today ? "ring-2 ring-white" : ""}`}>
              {new Date(`${d.date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "narrow", timeZone: "UTC" })}
            </span>
          ))}
        </div>
      </div>
      <p className="mt-4 text-sm text-white/80">A new problem arrives tomorrow. {modeFor(addDays(today, 1)) === "full" ? "You'll solve the whole thing, step by step." : "You'll solve its key step."}</p>
    </div>
  );
}

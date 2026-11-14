"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { finalizeAttempt as serverFinalize, submitAttempt as serverSubmit } from "../../actions/trainer";
import { ERROR_TYPES, label, type ErrorType } from "@/lib/tags";

export interface TrainerProblem {
  id: string;
  reason: string;
  source: "aops_wiki" | "generated" | "pasted";
  title: string;
  url: string | null;
  statement: string | null;
  choices: Record<string, string> | null;
  difficulty: number;
  techniqueTags: string[];
  attempt: null | {
    id: string;
    answer: string | null;
    correct: boolean;
    seconds: number;
    finalized: boolean;
    keyIdea: string | null;
    errorType: string | null;
    correctAnswer: string;
    solutionUrl: string | null;
  };
}

/** Where attempts are saved. Defaults to the signed-in server actions; guest mode passes browser-local ones. */
export interface TrainerActions {
  submitAttempt: typeof serverSubmit;
  finalizeAttempt: typeof serverFinalize;
}
const SERVER_ACTIONS: TrainerActions = { submitAttempt: serverSubmit, finalizeAttempt: serverFinalize };

const LETTERS = ["A", "B", "C", "D", "E"] as const;

/** Technique names are hints, so they are only revealed after the attempt. */
function reasonLabel(reason: string, reveal: boolean) {
  const tag = reveal ? ` · ${label(reason.slice(5))}` : "";
  if (reason.startsWith("twin:")) return `Review twin${tag}`;
  if (reason.startsWith("weak:")) return `Weak spot${tag}`;
  if (reason === "stretch") return "Stretch";
  return "Practice";
}

function fmt(sec: number) {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

export function TrainerClient({
  sessionId,
  problems: initial,
  actions = SERVER_ACTIONS,
  basePath = "",
}: {
  sessionId: string;
  problems: TrainerProblem[];
  actions?: TrainerActions;
  /** Prefix for in-app links ("" for the signed-in app, "/guest" for guest mode). */
  basePath?: string;
}) {
  const [problems, setProblems] = useState(initial);
  const firstOpen = problems.findIndex((p) => !p.attempt?.finalized);
  const [index, setIndex] = useState(firstOpen === -1 ? problems.length : firstOpen);
  const done = problems.filter((p) => p.attempt?.finalized).length;

  if (index >= problems.length) {
    return (
      <div className="card text-center">
        <p className="text-5xl" aria-hidden>🎉</p>
        <h1 className="h1 mt-2">Trainer done</h1>
        <p className="mt-1 text-muted">
          {problems.filter((p) => p.attempt?.correct).length} / {problems.length} correct. Misses will come back as twins.
        </p>
        <Link href={basePath || "/"} className="btn mt-4">Back to today</Link>
      </div>
    );
  }

  const update = (id: string, attempt: TrainerProblem["attempt"]) =>
    setProblems((ps) => ps.map((p) => (p.id === id ? { ...p, attempt } : p)));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2" aria-label={`Problem ${index + 1} of ${problems.length}`}>
        {problems.map((p, i) => (
          <span
            key={p.id}
            className={`h-2 flex-1 rounded-full ${p.attempt?.finalized ? (p.attempt.correct ? "bg-mastery" : "bg-danger") : i === index ? "bg-brand" : "bg-line"}`}
          />
        ))}
      </div>
      <p className="text-sm text-muted">{done} of {problems.length} done</p>
      <ProblemCard
        key={problems[index].id}
        sessionId={sessionId}
        actions={actions}
        problem={problems[index]}
        onAttempt={(a) => update(problems[index].id, a)}
        onNext={() => setIndex((i) => i + 1)}
      />
    </div>
  );
}

function useStopwatch(key: string, running: boolean) {
  const startRef = useRef<number>(0);
  const [sec, setSec] = useState(0);
  useEffect(() => {
    let start = Date.now();
    try {
      const saved = sessionStorage.getItem(key);
      if (saved) start = Number(saved);
      else sessionStorage.setItem(key, String(start));
    } catch {}
    startRef.current = start;
    setSec(Math.floor((Date.now() - start) / 1000));
  }, [key]);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setSec(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, [running]);
  return sec;
}

function ProblemCard({
  sessionId,
  actions,
  problem,
  onAttempt,
  onNext,
}: {
  sessionId: string;
  actions: TrainerActions;
  problem: TrainerProblem;
  onAttempt: (a: TrainerProblem["attempt"]) => void;
  onNext: () => void;
}) {
  const attempt = problem.attempt;
  const sec = useStopwatch(`timer:${sessionId}:${problem.id}`, !attempt);
  const [answer, setAnswer] = useState<(typeof LETTERS)[number] | null | undefined>(undefined); // null = blank
  const [confidence, setConfidence] = useState<number | null>(null);
  const [familiar, setFamiliar] = useState<boolean | null>(null);
  const [keyIdea, setKeyIdea] = useState(attempt?.keyIdea ?? "");
  const [errorType, setErrorType] = useState<ErrorType | null>((attempt?.errorType as ErrorType | null) ?? null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const over = sec > 25 * 60;

  const canSubmit = answer !== undefined && confidence !== null && familiar !== null;
  const choiceList = useMemo(() => (problem.choices ? LETTERS.map((l) => [l, problem.choices![l]] as const) : null), [problem.choices]);

  const submit = () =>
    start(async () => {
      setError(null);
      const res = await actions.submitAttempt({
        sessionId,
        problemId: problem.id,
        answer: answer ?? null,
        confidence: confidence!,
        familiar: familiar!,
        seconds: sec,
      });
      if (!res.ok) return setError(res.error);
      try {
        sessionStorage.removeItem(`timer:${sessionId}:${problem.id}`);
      } catch {}
      onAttempt({
        id: res.attemptId,
        answer: answer ?? null,
        correct: res.correct,
        seconds: sec,
        finalized: false,
        keyIdea: null,
        errorType: null,
        correctAnswer: res.correctAnswer,
        solutionUrl: res.solutionUrl,
      });
    });

  const finalize = () =>
    start(async () => {
      setError(null);
      const res = await actions.finalizeAttempt({ attemptId: attempt!.id, keyIdea, errorType: attempt!.correct ? null : errorType });
      if (!res.ok) return setError(res.error ?? "Could not save");
      onAttempt({ ...attempt!, finalized: true, keyIdea, errorType });
      onNext();
    });

  return (
    <article className="card space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">{reasonLabel(problem.reason, !!attempt)}</p>
          <h1 className="h2">{problem.title}</h1>
          {problem.source === "generated" && (
            <p className="text-xs font-semibold text-familiar">Generated practice problem: not an official contest problem</p>
          )}
        </div>
        <div className={`rounded-lg px-2 py-1 font-mono text-lg font-bold tabular-nums ${over ? "bg-danger/10 text-danger" : "bg-canvas"}`} aria-live="off">
          {fmt(attempt ? attempt.seconds : sec)}
        </div>
      </header>

      {problem.source === "aops_wiki" ? (
        <a href={problem.url ?? "#"} target="_blank" rel="noopener noreferrer" className="btn-ghost w-full">
          Open problem on AoPS wiki ↗
        </a>
      ) : (
        <div className="space-y-2">
          <p className="whitespace-pre-wrap leading-relaxed">{problem.statement}</p>
          {choiceList && (
            <ul className="space-y-1 text-sm">
              {choiceList.map(([l, c]) => (
                <li key={l}>
                  <span className="font-bold">({l})</span> {c}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!attempt ? (
        <>
          <fieldset>
            <legend className="label">Your answer</legend>
            <div className="grid grid-cols-6 gap-2">
              {LETTERS.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setAnswer(l)}
                  aria-pressed={answer === l}
                  className={`min-h-12 rounded-xl border-2 text-lg font-bold ${answer === l ? "border-brand bg-brand text-white" : "border-line bg-white"}`}
                >
                  {l}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setAnswer(null)}
                aria-pressed={answer === null}
                className={`min-h-12 rounded-xl border-2 text-xs font-bold ${answer === null ? "border-ink bg-ink text-white" : "border-line bg-white text-muted"}`}
              >
                Blank
              </button>
            </div>
          </fieldset>

          <fieldset>
            <legend className="label">Confidence</legend>
            <div className="grid grid-cols-3 gap-2">
              {[
                [1, "Guess"],
                [2, "Unsure"],
                [3, "Sure"],
              ].map(([v, t]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setConfidence(v as number)}
                  aria-pressed={confidence === v}
                  className={`min-h-11 rounded-xl border-2 text-sm font-semibold ${confidence === v ? "border-brand bg-brand/10 text-brand" : "border-line"}`}
                >
                  {v} · {t}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="label">Have you seen this problem before?</legend>
            <div className="grid grid-cols-2 gap-2">
              {[
                [false, "No, it's new"],
                [true, "Yes, seen it"],
              ].map(([v, t]) => (
                <button
                  key={String(v)}
                  type="button"
                  onClick={() => setFamiliar(v as boolean)}
                  aria-pressed={familiar === v}
                  className={`min-h-11 rounded-xl border-2 text-sm font-semibold ${familiar === v ? "border-brand bg-brand/10 text-brand" : "border-line"}`}
                >
                  {t as string}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted">Seen-before attempts don&apos;t count toward your score stats.</p>
          </fieldset>

          <button className="btn w-full" disabled={!canSubmit || pending} onClick={submit}>
            {pending ? "Checking…" : "Submit answer"}
          </button>
        </>
      ) : (
        <>
          <div className={`rounded-xl p-3 ${attempt.correct ? "bg-mastery/10" : "bg-danger/10"}`} role="status">
            <p className={`font-bold ${attempt.correct ? "text-mastery" : "text-danger"}`}>
              {attempt.correct ? "Correct!" : attempt.answer ? `Not quite: you said ${attempt.answer}` : "Left blank"}
            </p>
            <p className="text-sm">Answer: <span className="font-bold">{attempt.correctAnswer}</span></p>
            {attempt.solutionUrl && (
              <a href={attempt.solutionUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-brand">
                See solutions ↗
              </a>
            )}
          </div>

          {!attempt.correct && (
            <fieldset>
              <legend className="label">What went wrong?</legend>
              <div className="grid grid-cols-2 gap-2">
                {ERROR_TYPES.map((e) => (
                  <button
                    key={e.value}
                    type="button"
                    onClick={() => setErrorType(e.value)}
                    aria-pressed={errorType === e.value}
                    className={`min-h-11 rounded-xl border-2 text-sm font-semibold ${errorType === e.value ? "border-danger bg-danger/10 text-danger" : "border-line"}`}
                  >
                    {e.label}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          <div>
            <label className="label" htmlFor="keyIdea">Key idea, in one sentence</label>
            <textarea
              id="keyIdea"
              className="input min-h-20"
              maxLength={280}
              value={keyIdea}
              onChange={(e) => setKeyIdea(e.target.value)}
              placeholder="e.g. Count the complement: total arrangements minus those with no two adjacent."
            />
            <p className="mt-1 text-xs text-muted">Required. This is what you&apos;ll reread on error-review day.</p>
          </div>
          <button
            className="btn w-full"
            disabled={pending || keyIdea.trim().length < 5 || (!attempt.correct && !errorType)}
            onClick={finalize}
          >
            {pending ? "Saving…" : "Save & next"}
          </button>
        </>
      )}
      {error && <p className="text-sm font-medium text-danger" role="alert">{error}</p>}
      <p className="text-xs text-muted">
        Position ~{problem.difficulty}
        {attempt && <> · {problem.techniqueTags.map(label).join(", ")}</>}
      </p>
    </article>
  );
}

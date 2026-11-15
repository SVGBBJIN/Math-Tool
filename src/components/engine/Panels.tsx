"use client";
// The untimed screens around a card: the interactive worked example before it and the
// reveal after it.
import { useMemo, useState } from "react";
import { parseState } from "@/lib/engine/expr/state";
import { toLatex } from "@/lib/engine/expr/ast";
import type { Result } from "@/lib/engine/progress";
import { moduleOf, type Card } from "@/lib/engine/registry";
import { keyMoveName, referenceLines } from "@/lib/engine/ui";
import { ERROR_TYPES } from "@/lib/tags";
import { CardRunner, type RunResult } from "./CardRunner";
import { Tex } from "./Tex";

/** A Module A line as math; Module B lines stay text. */
function LineMath({ card, line }: { card: Card; line: string }) {
  if (card.module !== "expr") return <>{line}</>;
  try {
    const s = parseState(line.replace(/\s+\[.*\]$/, "").replace(/\s+or\s+/g, " or ").replace(/\(mod (\d+)\)$/, "mod $1"));
    const latex = s.kind === "eqs" ? s.eqs.map((e) => `${toLatex(e.lhs)} = ${toLatex(e.rhs)}`).join("\\ \\text{ or }\\ ") : s.kind === "mod" ? `${toLatex(s.expr)} \\pmod{${s.mod}}` : toLatex(s.expr);
    return <Tex latex={latex} />;
  } catch {
    return <>{line}</>;
  }
}

/** The shortest path, replayed line by line, with the key step called out. */
function Replay({ card, emphasize }: { card: Card; emphasize: boolean }) {
  const lines = useMemo(() => referenceLines(card), [card]);
  return (
    <ol className="space-y-1.5">
      {lines.map((l, i) => (
        <li key={i} className={`replay-line rounded-lg px-2 py-1 ${l.key ? `bg-familiar/15 ring-1 ring-familiar/50 ${emphasize ? "ring-2" : ""}` : ""}`} style={{ animationDelay: `${i * 0.6}s` }}>
          {l.step && (
            <p className="text-xs text-muted">
              {l.key && <span className="mr-1 font-bold uppercase text-ink">Key step</span>}
              {l.step}
            </p>
          )}
          <p className="font-semibold"><LineMath card={card} line={l.line} /></p>
        </li>
      ))}
    </ol>
  );
}

/**
 * The worked example, interactive: the student predicts each step by performing it on the
 * workspace (guided, untimed) before it is shown. "Show me" reveals a step with no penalty.
 */
export function WorkedExample({ card, title, again, onDone }: { card: Card; title: string; again?: boolean; onDone: () => void }) {
  return (
    <div className="space-y-2">
      <header className="px-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand">{again ? "Let's work the example again" : "Worked example"}</p>
        <h1 className="h2">{title}</h1>
        <p className="text-sm text-muted">Predict each step by doing it. If you&apos;re stuck, Show me reveals it. Nothing here is scored.</p>
      </header>
      <CardRunner card={card} level={1} budget={0} timed={false} adaptive={false} label={title} mode="predict" onPredictDone={onDone} />
    </div>
  );
}

const HEADLINE: Record<Result, string> = {
  pass: "Solved",
  assisted: "Solved, with help",
  timeout: "Out of time",
  not_sure: "Not sure: here's the idea",
};

/** Untimed and short: an animated replay of the shortest path, one line of insight, and (after a miss) what went wrong. */
export function Reveal({
  card, result, run, messages, isMistake, onNext,
}: {
  card: Card; result: Result; run: RunResult; messages: string[]; isMistake: boolean;
  onNext: (errorType: string | null, note: string) => void;
}) {
  const [errorType, setErrorType] = useState<string | null>(result === "timeout" ? "out_of_time" : null);
  const [note, setNote] = useState("");
  const good = result === "pass";
  const shortest = card.path.filter((s) => s.move !== "check").length;
  const longWay = run.outcome === "solved" && run.stepCount > shortest;
  return (
    <article className="card space-y-3">
      <div className={`rounded-xl p-3 ${good ? "bg-mastery/10" : result === "assisted" ? "bg-familiar/10" : "bg-danger/10"}`} role="status">
        <p className={`font-bold ${good ? "text-mastery" : result === "assisted" ? "text-ink" : "text-danger"}`}>{HEADLINE[result]}</p>
        <p className="text-sm">Answer: <span className="font-bold"><LineMath card={card} line={moduleOf(card).answer(card)} /></span></p>
        <p className="text-xs text-muted">Time: {Math.round(run.seconds)}s</p>
        {result === "assisted" && <p className="text-sm text-muted">No mastery credit this time. This idea will come back with new numbers.</p>}
      </div>

      <div>
        <p className="label">Shortest path</p>
        <div className="rounded-xl bg-canvas p-2 text-sm"><Replay card={card} emphasize={run.skippedKeyMove || longWay} /></div>
      </div>
      {run.skippedKeyMove && (
        <p className="rounded-xl bg-familiar/10 p-3 text-sm">You got there without the key step: <span className="font-semibold">{keyMoveName(card)}</span>. It is the shorter route.</p>
      )}
      {longWay && !run.skippedKeyMove && (
        <p className="rounded-xl bg-familiar/10 p-3 text-sm">You took {run.stepCount} steps; the shortest path takes {shortest}. Watch for the highlighted key step: <span className="font-semibold">{keyMoveName(card)}</span>.</p>
      )}
      {!isMistake && run.failedStep && <p className="text-sm text-muted">Stopped at: {run.failedStep}</p>}
      <p className="rounded-xl bg-mastery/10 p-3 text-sm font-semibold">{card.insight}</p>
      {messages.map((m) => <p key={m} className="text-sm font-semibold text-brand">{m}</p>)}

      {isMistake && (
        // Metadata about the miss for the mistakes log, not part of the problem.
        <div data-metadata="error-type" className="space-y-2 border-t border-line pt-3">
          {run.failedStep && <p className="text-sm">Stopped at: <span className="font-semibold">{run.failedStep}</span></p>}
          <fieldset>
            <legend className="label">Tag this miss: what went wrong?</legend>
            <div className="flex flex-wrap gap-1.5">
              {ERROR_TYPES.map((e) => (
                <button key={e.value} type="button" onClick={() => setErrorType(e.value)} aria-pressed={errorType === e.value}
                  className={`min-h-11 rounded-full border-2 px-3 text-sm font-semibold ${errorType === e.value ? "border-danger bg-danger/10 text-danger" : "border-line"}`}>
                  {e.label}
                </button>
              ))}
            </div>
          </fieldset>
          <div>
            <label className="label" htmlFor="miss-note">One-line note (optional)</label>
            <input id="miss-note" className="input" maxLength={140} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. forgot to check for a common factor" />
          </div>
        </div>
      )}
      <button type="button" className="btn w-full" disabled={isMistake && !errorType} onClick={() => onNext(errorType, note)}>Next</button>
    </article>
  );
}

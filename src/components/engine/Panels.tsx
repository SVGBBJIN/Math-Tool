"use client";
// The untimed screens around a card: the worked example before it and the reveal after it.
import { useMemo, useState } from "react";
import type { Result } from "@/lib/engine/progress";
import { moduleOf, type Card } from "@/lib/engine/registry";
import { keyMoveName, referenceLines } from "@/lib/engine/ui";
import { ERROR_TYPES } from "@/lib/tags";
import type { RunResult } from "./CardRunner";

function Path({ card }: { card: Card }) {
  const lines = useMemo(() => referenceLines(card), [card]);
  return (
    <ol className="space-y-1.5">
      {lines.map((l, i) => (
        <li key={i} className={`rounded-lg px-2 py-1 ${l.key ? "bg-familiar/15 ring-1 ring-familiar/50" : ""}`}>
          {l.step && (
            <p className="text-xs text-muted">
              {l.key && <span className="mr-1 font-bold uppercase text-ink">Key move</span>}
              {l.step}
            </p>
          )}
          <p className="font-semibold">{l.line}</p>
        </li>
      ))}
    </ol>
  );
}

/** A 30-second read: the whole solution with the key move called out. */
export function WorkedExample({ card, title, again, onDone }: { card: Card; title: string; again?: boolean; onDone: () => void }) {
  return (
    <article className="card space-y-3">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-brand">{again ? "Let's look at the example again" : "Worked example · about 30 seconds"}</p>
        <h1 className="h2">{title}</h1>
      </header>
      <p className="leading-relaxed">{card.prompt}</p>
      <div className="rounded-xl bg-canvas p-2"><Path card={card} /></div>
      {card.why && <p className="text-sm leading-relaxed">{card.why}</p>}
      <p className="rounded-xl bg-mastery/10 p-3 text-sm font-semibold">{card.insight}</p>
      <button type="button" className="btn w-full" onClick={onDone}>{again ? "Got it" : "Got it — my turn"}</button>
    </article>
  );
}

const HEADLINE: Record<Result, string> = {
  pass: "Solved ✓",
  assisted: "Solved, with help",
  timeout: "Out of time",
  not_sure: "Not sure — here's the idea",
};

/** Untimed and short: the shortest path, one line of insight, and (after a miss) what went wrong. */
export function Reveal({
  card, result, run, messages, isMistake, onNext,
}: {
  card: Card; result: Result; run: RunResult; messages: string[]; isMistake: boolean;
  onNext: (errorType: string | null, note: string) => void;
}) {
  const [errorType, setErrorType] = useState<string | null>(result === "timeout" ? "out_of_time" : null);
  const [note, setNote] = useState("");
  const good = result === "pass";
  return (
    <article className="card space-y-3">
      <div className={`rounded-xl p-3 ${good ? "bg-mastery/10" : result === "assisted" ? "bg-familiar/10" : "bg-danger/10"}`} role="status">
        <p className={`font-bold ${good ? "text-mastery" : result === "assisted" ? "text-ink" : "text-danger"}`}>{HEADLINE[result]}</p>
        <p className="text-sm">Answer: <span className="font-bold">{moduleOf(card).answer(card)}</span> · {Math.round(run.seconds)}s</p>
        {result === "assisted" && <p className="text-sm text-muted">No mastery credit this time. This idea will come back with new numbers.</p>}
      </div>

      <div>
        <p className="label">Shortest path</p>
        <div className="rounded-xl bg-canvas p-2 text-sm"><Path card={card} /></div>
      </div>
      {run.skippedKeyMove && (
        <p className="rounded-xl bg-familiar/10 p-3 text-sm">You got there without the key move: <span className="font-semibold">{keyMoveName(card)}</span>. It is the shorter route.</p>
      )}
      <p className="rounded-xl bg-mastery/10 p-3 text-sm font-semibold">{card.insight}</p>
      {messages.map((m) => <p key={m} className="text-sm font-semibold text-brand">{m}</p>)}

      {isMistake && (
        <>
          <fieldset>
            <legend className="label">What went wrong?</legend>
            <div className="grid grid-cols-2 gap-2">
              {ERROR_TYPES.map((e) => (
                <button key={e.value} type="button" onClick={() => setErrorType(e.value)} aria-pressed={errorType === e.value}
                  className={`min-h-11 rounded-xl border-2 text-sm font-semibold ${errorType === e.value ? "border-danger bg-danger/10 text-danger" : "border-line"}`}>
                  {e.label}
                </button>
              ))}
            </div>
          </fieldset>
          <div>
            <label className="label" htmlFor="miss-note">One-line note (optional)</label>
            <input id="miss-note" className="input" maxLength={140} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. forgot to check for a common factor" />
          </div>
        </>
      )}
      <button type="button" className="btn w-full" disabled={isMistake && !errorType} onClick={() => onNext(errorType, note)}>Next</button>
    </article>
  );
}

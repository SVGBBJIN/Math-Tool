"use client";
// One learning card, start to finish: (teach) → task → check → feedback → explanation and
// takeaway. No timer anywhere. A wrong first answer gets reasoning-based feedback and one
// more try; "Show me" is always there and is recorded honestly as skipped.
import { useRef, useState } from "react";
import { check, responseText, type CheckResult } from "@/lib/learn/cards/check";
import { DIMENSION_OF, type Card, type Response } from "@/lib/learn/cards/types";
import { ERROR_TYPES } from "@/lib/tags";
import type { CardResult } from "@/lib/learn/record";
import type { Slot } from "@/lib/learn/state";
import { FigureView } from "./FigureView";
import { Interaction, emptyResponse, hasAnswer } from "./Interaction";
import { Rich } from "./Rich";
import { RoleChip } from "./bits";

type Phase = "teach" | "task" | "retry" | "compare" | "done";

export function CardView({ card, slot, reason, onRecord, onNext, nextLabel = "Next", onMissDetails, footer }: {
  card: Card;
  slot: Slot;
  reason?: string;
  /** Called once, when the answer becomes final. */
  onRecord: (r: CardResult) => { missId: string | null; messages: string[] };
  onNext: () => void;
  nextLabel?: string;
  onMissDetails?: (missId: string, errorType: string) => void;
  footer?: React.ReactNode;
}) {
  const [phase, setPhase] = useState<Phase>(card.teach ? "teach" : "task");
  const [response, setResponse] = useState<Response>(() => emptyResponse(card.interaction));
  const [result, setResult] = useState<CheckResult | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [hint, setHint] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const [missId, setMissId] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<string | null>(null);
  const [invalid, setInvalid] = useState<string | null>(null);
  const recorded = useRef(false);
  const i = card.interaction;
  const teaching = DIMENSION_OF[card.type] === "comprehension";

  const finish = (outcome: CardResult["outcome"], tries: number, r: CheckResult | null) => {
    setPhase("done");
    if (recorded.current) return;
    recorded.current = true;
    const out = onRecord({ cardId: card.id, slot, outcome, attempts: tries, hintUsed: hint, selfReported: !!r?.selfReported, answered: outcome === "skipped" ? "" : responseText(card, response) });
    setMissId(out.missId);
    setMessages(out.messages);
  };

  const submit = () => {
    if (phase !== "task" && phase !== "retry") return;
    if (i.kind === "explain" && phase === "task") {
      if (!hasAnswer(response)) return setInvalid("Write a sentence or two in your own words first.");
      setInvalid(null);
      return setPhase("compare");
    }
    const r = check(card, response);
    if (r.status === "invalid") return setInvalid(r.message);
    setInvalid(null);
    const tries = attempts + 1;
    setAttempts(tries);
    setResult(r);
    if (r.status === "correct") return finish("correct", tries, r);
    // A second try is offered once, except where it would just be elimination.
    const twoOptions = i.kind === "choice" && i.options.length <= 2;
    if (tries === 1 && !twoOptions && i.kind !== "explain") return setPhase("retry");
    finish("incorrect", tries, r);
  };

  const showMe = () => {
    // After a wrong attempt this is a miss, not a skip: the attempt was real.
    if (phase === "retry" && result) return finish("incorrect", attempts, result);
    setSkipped(true);
    finish("skipped", attempts, null);
  };

  const done = phase === "done";
  const correct = done && result?.status === "correct";

  return (
    <article className="learn-card card-in" data-role={slot} aria-live="polite">
      <header className="mb-4 flex flex-wrap items-center gap-2">
        <RoleChip slot={slot} type={card.type} />
        {reason && <span className="text-xs text-muted">{reason}</span>}
      </header>
      <h2 className="text-xl font-bold tracking-tight md:text-2xl">{card.title}</h2>

      {card.teach && (
        <section className={`mt-4 ${phase === "teach" ? "" : "rounded-2xl bg-canvas p-4 text-[15px]"}`}>
          {phase !== "teach" && <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">The method</p>}
          <p className={phase === "teach" ? "prose-card" : ""}><Rich text={card.teach.body} /></p>
          {card.teach.steps && (
            <ol className={`mt-3 space-y-1.5 border-l-2 border-brand/30 pl-4 ${phase === "teach" ? "prose-card" : ""}`}>
              {card.teach.steps.map((s, k) => <li key={k}><Rich text={s} /></li>)}
            </ol>
          )}
          {phase === "teach" && <button type="button" className="btn mt-5" onClick={() => setPhase("task")}>Try it</button>}
        </section>
      )}

      {phase !== "teach" && (
        <>
          <p className="prose-card mt-4"><Rich text={card.prompt} /></p>
          {card.figure && i.kind !== "tap" && <FigureView figure={card.figure} />}
          <div className="mt-4">
            <Interaction card={card} value={response} onChange={(r) => { setResponse(r); setInvalid(null); }} onSubmit={submit} locked={done || phase === "compare"} parts={result?.parts} />
          </div>
          {invalid && <p className="mt-2 text-sm font-medium text-reinforce" role="alert">{invalid}</p>}

          {hint && !done && card.hint && (
            <p className="callout mt-4 bg-canvas text-[15px]"><span className="font-semibold">Hint: </span><Rich text={card.hint} /></p>
          )}

          {phase === "retry" && result && (
            <div className="callout mt-4 border border-reinforce/30 bg-reinforce/5">
              <p className="font-semibold text-reinforce">Not quite.</p>
              <p className="mt-1 text-[15px]"><Rich text={result.message} /></p>
              <p className="mt-2 text-sm text-muted">Adjust your answer and check again, or see the full reasoning.</p>
            </div>
          )}

          {phase === "compare" && i.kind === "explain" && (
            <div className="mt-4 space-y-3">
              <div className="callout bg-canvas">
                <p className="text-xs font-bold uppercase tracking-wide text-muted">A complete answer</p>
                <p className="mt-1 text-[15px]"><Rich text={i.model} /></p>
              </div>
              <fieldset>
                <legend className="text-sm font-semibold">Be honest: which of these did you say?</legend>
                {i.points.map((p, k) => {
                  const r = response as Extract<Response, { kind: "explain" }>;
                  const on = r.covered.includes(k);
                  return (
                    <label key={k} className="mt-2 flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3">
                      <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--color-brand)]" checked={on}
                        onChange={() => setResponse({ ...r, covered: on ? r.covered.filter((x) => x !== k) : [...r.covered, k] })} />
                      <span className="text-[15px]"><Rich text={p} /></span>
                    </label>
                  );
                })}
              </fieldset>
              <button type="button" className="btn w-full" onClick={() => { const r = check(card, response); setResult(r); setAttempts(1); finish(r.status === "correct" ? "correct" : "incorrect", 1, r); }}>Done</button>
            </div>
          )}

          {(phase === "task" || phase === "retry") && (
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button type="button" className="btn min-w-32" disabled={!hasAnswer(response)} onClick={submit}>
                {i.kind === "explain" ? "Compare" : phase === "retry" ? "Check again" : "Check"}
              </button>
              {card.hint && !hint && phase === "task" && <button type="button" className="btn-ghost" onClick={() => setHint(true)}>Hint</button>}
              <button type="button" className="ml-auto text-sm font-semibold text-muted hover:text-ink" onClick={showMe}>
                {phase === "retry" ? "Show the reasoning" : "Show me"}
              </button>
            </div>
          )}
        </>
      )}

      {done && (
        <section className="mt-5 space-y-4">
          {skipped ? (
            <p className="callout bg-canvas text-[15px]"><span className="font-semibold">Here&apos;s how it works.</span> Read it through once; this idea will come back on another problem.</p>
          ) : result && (
            <div className={`callout ${correct ? "bg-apply/8 border border-apply/25" : "border border-reinforce/30 bg-reinforce/5"}`}>
              <p className={`font-semibold ${correct ? "text-apply" : "text-reinforce"}`}>
                {correct ? (attempts > 1 || hint ? "Got there." : teaching ? "Yes." : "Right.") : teaching ? "Here's the idea." : "Not this time."}
              </p>
              <p className="mt-1 text-[15px]"><Rich text={result.message} /></p>
            </div>
          )}

          <div>
            <p className="prose-card"><Rich text={card.explanation.summary} /></p>
            {card.explanation.steps && (
              <ol className="mt-2 space-y-1 border-l-2 border-line pl-4 text-[15px]">
                {card.explanation.steps.map((s, k) => <li key={k}><Rich text={s} /></li>)}
              </ol>
            )}
          </div>

          <div className="rounded-2xl px-5 py-4 text-white" style={{ backgroundImage: "linear-gradient(135deg, #312e81, var(--color-violet) 65%, var(--color-pink))" }}>
            <p className="text-xs font-bold uppercase tracking-wide text-white/60">Remember</p>
            <p className="mt-1 text-lg font-semibold leading-snug"><Rich text={card.takeaway} /></p>
            <p className="mt-2 text-sm text-white/75"><span className="font-semibold text-white/90">Use it when: </span><Rich text={card.whenToUse} /></p>
          </div>

          {missId && onMissDetails && (
            <div>
              <p className="text-sm font-semibold text-muted">What got in the way? <span className="font-normal">(optional, for your error log)</span></p>
              <div className="mt-2 flex flex-wrap gap-2">
                {ERROR_TYPES.filter((e) => e.value !== "out_of_time").map((e) => (
                  <button key={e.value} type="button" aria-pressed={errorType === e.value}
                    className={`chip !px-3 !py-1.5 !text-sm ${errorType === e.value ? "!bg-ink !text-white" : ""}`}
                    onClick={() => { setErrorType(e.value); onMissDetails(missId, e.value); }}>{e.label}</button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => <p key={m} className="rounded-xl border border-apply/30 bg-apply/5 px-4 py-2 text-sm font-semibold text-apply">{m}</p>)}

          <button type="button" className="btn w-full" onClick={onNext} autoFocus>{nextLabel}</button>
          {footer}
        </section>
      )}
    </article>
  );
}

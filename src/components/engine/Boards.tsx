"use client";
// What the student sees and taps: the current line (Module A) or structure (Module B).
import { show } from "@/lib/engine/expr/ast";
import { partsOf, sideOf, type ExprState, type Target } from "@/lib/engine/expr/state";
import { structValue, template, type StructCard, type StructState } from "@/lib/engine/struct/module";

const pick = "rounded-lg px-2 py-1 transition";
const on = "bg-brand/10 ring-2 ring-brand";
const off = "hover:bg-canvas";

export function ExprBoard({ state, target, onTarget, trail }: { state: ExprState; target: Target; onTarget: (t: Target) => void; trail: string[] }) {
  const side = state.kind === "mod" ? state.expr : sideOf(state, target);
  const parts = partsOf(side);
  return (
    <div className="rounded-xl bg-canvas p-3">
      {trail.length > 0 && (
        <ol className="mb-2 space-y-0.5 text-sm text-muted" aria-label="Earlier lines">
          {trail.map((line, i) => <li key={i}>{line}</li>)}
        </ol>
      )}
      <div className="text-xl font-semibold leading-relaxed" aria-live="polite">
        {state.kind === "expr" && <span>{show(state.expr)}</span>}
        {state.kind === "mod" && <span>{show(state.expr)} <span className="text-base text-muted">(mod {state.mod})</span></span>}
        {state.kind === "eqs" &&
          state.eqs.map((eq, i) => {
            const sel = (target.eq ?? 0) === i;
            return (
              <div key={i} className="flex flex-wrap items-center gap-1">
                {i > 0 && <span className="mr-1 text-sm font-normal text-muted">or</span>}
                <button type="button" className={`${pick} ${sel && target.side !== "rhs" ? on : off}`} onClick={() => onTarget({ eq: i, side: "lhs" })}>
                  {show(eq.lhs)}
                </button>
                <span>=</span>
                <button type="button" className={`${pick} ${sel && target.side === "rhs" ? on : off}`} onClick={() => onTarget({ eq: i, side: "rhs" })}>
                  {show(eq.rhs)}
                </button>
              </div>
            );
          })}
      </div>
      {state.kind !== "mod" && state.sub && <p className="mt-1 text-sm text-familiar">where {state.sub.name} = {show(state.sub.expr)}</p>}
      {parts.length > 1 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-sm">
          <span className="text-muted">Act on:</span>
          <button type="button" className={`chip ${target.part === undefined ? "!bg-brand !text-white" : ""}`} onClick={() => onTarget({ ...target, part: undefined })}>
            the whole {state.kind === "eqs" ? "side" : "line"}
          </button>
          {parts.map((p, i) => (
            <button key={i} type="button" className={`chip ${target.part === i ? "!bg-brand !text-white" : ""}`} onClick={() => onTarget({ ...target, part: i })}>
              {show(p)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function StructBoard({ card, state }: { card: StructCard; state: StructState }) {
  const t = template(card.template);
  const complete = state.terms.length > 0 && state.terms.every((x) => x.slots.length);
  return (
    <div className="rounded-xl bg-canvas p-3" aria-live="polite">
      {state.terms.length === 0 && <p className="text-muted">Empty. Add the first slot.</p>}
      <div className="space-y-2">
        {state.terms.map((term, i) => (
          <div key={i} className="flex flex-wrap items-start gap-1.5">
            {(i > 0 || term.sign < 0) && <span className="mt-1 text-xl font-bold">{term.sign < 0 ? "−" : "+"}</span>}
            {term.slots.length === 0 && <span className="mt-1.5 text-sm text-muted">new part: add a slot</span>}
            {term.slots.map((id, j) => {
              const slot = t.slots.find((s) => s.id === id)!;
              return (
                <span key={j} className="flex max-w-[8.5rem] flex-col rounded-lg border border-line bg-white px-2 py-1">
                  <span className="text-lg font-bold leading-tight">{j > 0 && "× "}{slot.count(card.full, j)}</span>
                  <span className="text-[11px] leading-tight text-muted">{slot.label(card.full)}</span>
                </span>
              );
            })}
            {term.div && (
              <span className="flex max-w-[8.5rem] flex-col rounded-lg border border-familiar/60 bg-familiar/10 px-2 py-1">
                <span className="text-lg font-bold leading-tight">÷ {t.divisors.find((d) => d.id === term.div)!.value(card.full)}</span>
                <span className="text-[11px] leading-tight text-muted">{t.divisors.find((d) => d.id === term.div)!.label(card.full)}</span>
              </span>
            )}
          </div>
        ))}
      </div>
      {complete && <p className="mt-2 text-lg font-semibold">= {structValue(card, state)}</p>}
    </div>
  );
}

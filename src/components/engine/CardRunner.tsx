"use client";
// The timed decision step of one card: board, move menu (by scaffolding level), hints,
// undo and the free "not sure". Every move goes through the module's verifier.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { defaultTarget } from "@/lib/engine/expr/module";
import type { ExprState, Target } from "@/lib/engine/expr/state";
import type { Outcome } from "@/lib/engine/progress";
import { moduleOf, type Card } from "@/lib/engine/registry";
import type { StructCard, StructState } from "@/lib/engine/struct/module";
import type { MoveDef, MoveInput, MoveOption } from "@/lib/engine/types";
import { hintText, matchMove, menuOptions, moveDefs } from "@/lib/engine/ui";
import { ExprBoard, StructBoard } from "./Boards";

export interface RunResult {
  outcome: Outcome;
  seconds: number;
  wrongMoves: number;
  hintLevel: number;
  userAnswer: string;
  skippedKeyMove: boolean;
}

const LEVEL_TEXT = { 1: "Level 1 · pick from 4 moves", 2: "Level 2 · all moves", 3: "Level 3 · name the move first" } as const;
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.ceil(s)) % 60).padStart(2, "0")}`;

export function CardRunner({ card, level, budget, label, onFinish }: { card: Card; level: 1 | 2 | 3; budget: number; label: string; onFinish: (r: RunResult) => void }) {
  const mod = useMemo(() => moduleOf(card), [card]);
  const [states, setStates] = useState<unknown[]>(() => [mod.init(card)]);
  const [used, setUsed] = useState<string[]>([]);
  const [target, setTarget] = useState<Target | null>(null);
  const [open, setOpen] = useState<MoveDef | null>(null); // move waiting for parameters
  const [params, setParams] = useState<Record<string, string>>({});
  const [focus, setFocus] = useState<string | null>(null);
  const [named, setNamed] = useState<MoveDef | null>(null); // level 3: the move the student named
  const [typed, setTyped] = useState("");
  const [feedback, setFeedback] = useState<{ reason: string; detail?: string[] } | null>(null);
  const [wrong, setWrong] = useState(0);
  const [hint, setHint] = useState(0);
  const [left, setLeft] = useState(budget);
  const started = useRef(Date.now());
  const finished = useRef(false);

  const cur = states[states.length - 1];
  const line = mod.show(cur, card);
  const isExpr = card.module === "expr";
  const activeTarget = target ?? (isExpr ? defaultTarget(cur as ExprState) : {});

  const finish = useCallback(
    (outcome: Outcome, finalLine: string, usedMoves: string[], wrongMoves: number, hintLevel: number) => {
      if (finished.current) return;
      finished.current = true;
      const elapsed = (Date.now() - started.current) / 1000;
      onFinish({
        outcome,
        seconds: outcome === "timeout" ? budget : Math.min(elapsed, budget),
        wrongMoves,
        hintLevel,
        userAnswer: finalLine || "(nothing yet)",
        skippedKeyMove: outcome === "solved" && !usedMoves.some((m) => card.keyMoves.includes(m)),
      });
    },
    [budget, card, onFinish],
  );

  // Visible countdown for the decision step only; the reveal that follows is untimed.
  const live = useRef({ line, used, wrong, hint });
  live.current = { line, used, wrong, hint };
  useEffect(() => {
    const tick = setInterval(() => {
      const remaining = budget - (Date.now() - started.current) / 1000;
      setLeft(remaining);
      if (remaining <= 0) {
        clearInterval(tick);
        const s = live.current;
        finish("timeout", s.line, s.used, s.wrong, s.hint);
      }
    }, 250);
    return () => clearInterval(tick);
  }, [budget, finish]);

  const options = useMemo(() => menuOptions(card, cur, line, level), [card, cur, line, level]);
  const defs = useMemo(() => moveDefs(card, cur), [card, cur]);

  function apply(input: MoveInput) {
    const r = mod.apply(card, cur, input);
    if (!r.ok) {
      setFeedback({ reason: r.reason, detail: r.detail });
      if (!r.noop) setWrong((w) => w + 1);
      return;
    }
    const nextUsed = [...used, input.move];
    setStates((s) => [...s, r.state]);
    setUsed(nextUsed);
    setTarget(null);
    setOpen(null);
    setNamed(null);
    setTyped("");
    setParams({});
    setFeedback(null);
    if (r.done) finish("solved", mod.show(r.state, card), nextUsed, wrong, hint);
  }

  function choose(o: MoveOption) {
    const def = mod.moveDef(card, o.move);
    if (o.preset || !def || def.params.length === 0) return apply({ move: o.move, params: o.preset, target: isExpr ? activeTarget : undefined });
    setOpen(def);
    setParams({});
    setFocus(def.params[0]?.name ?? null);
    setFeedback(null);
  }

  function name() {
    const m = matchMove(defs, typed);
    if ("error" in m) return setFeedback({ reason: m.error });
    setFeedback(null);
    setNamed(m.move);
    if (isExpr) {
      if (m.move.params.length === 0) return apply({ move: m.move.id, target: activeTarget });
      setOpen(m.move);
      setParams({});
      setFocus(m.move.params[0]?.name ?? null);
    } else if (m.move.params.length === 0) apply({ move: m.move.id });
  }

  function undo() {
    if (states.length < 2) return;
    setStates((s) => s.slice(0, -1));
    setUsed((u) => u.slice(0, -1));
    setTarget(null);
    setOpen(null);
    setFeedback(null);
  }

  const typeInto = (text: string) => focus && setParams((p) => ({ ...p, [focus]: (p[focus] ?? "") + text }));
  const flipSign = (key: string) => setParams((p) => ({ ...p, [key]: (p[key] ?? "").startsWith("-") ? (p[key] ?? "").slice(1) : "-" + (p[key] ?? "") }));
  const ready = open ? open.params.every((p) => (params[p.name] ?? "").trim() !== "") : false;
  const shown = level === 3 ? (named && !isExpr ? mod.options(card, cur).filter((o) => o.move === named.id) : []) : options;
  const low = left <= 10;

  return (
    <article className="card space-y-3">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">{label}</p>
          <p className="text-xs text-muted">{LEVEL_TEXT[level]}</p>
        </div>
        <div className={`rounded-lg px-2 py-1 font-mono text-lg font-bold tabular-nums ${low ? "bg-danger/10 text-danger" : "bg-canvas"}`} role="timer" aria-label="Time left">
          {fmt(left)}
        </div>
      </header>
      <div className="h-1.5 overflow-hidden rounded-full bg-canvas" aria-hidden>
        <div className={`h-full rounded-full ${low ? "bg-danger" : "bg-brand"}`} style={{ width: `${Math.max(0, Math.min(100, (left / budget) * 100))}%` }} />
      </div>

      <p className="leading-relaxed">{card.prompt}</p>
      {isExpr ? (
        <ExprBoard state={cur as ExprState} target={activeTarget} onTarget={setTarget} trail={states.slice(0, -1).map((s) => mod.show(s, card))} />
      ) : (
        <StructBoard card={card as StructCard} state={cur as StructState} />
      )}

      {feedback && (
        <div className="rounded-xl bg-danger/10 p-3 text-sm" role="alert">
          <p className="font-semibold text-danger">{feedback.reason}</p>
          {feedback.detail?.map((d, i) => <p key={i} className="mt-1">{d}</p>)}
        </div>
      )}
      {hint > 0 && <p className="rounded-xl bg-familiar/10 p-3 text-sm" role="status"><span className="font-semibold">Hint {hint}/3:</span> {hintText(card, cur, line, hint as 1 | 2 | 3)}</p>}

      {open ? (
        <div className="space-y-2 rounded-xl border border-brand/40 p-3">
          <p className="font-semibold">{open.name}</p>
          <p className="text-xs text-muted">{open.blurb}</p>
          {open.params.map((p) => (
            <div key={p.name}>
              <label className="label" htmlFor={`p-${p.name}`}>{p.label}</label>
              {p.kind === "choice" ? (
                <div className="grid grid-cols-2 gap-2">
                  {p.options?.map((o) => (
                    <button key={o.value} type="button" aria-pressed={params[p.name] === o.value} onClick={() => setParams((x) => ({ ...x, [p.name]: o.value }))}
                      className={`min-h-11 rounded-xl border-2 text-sm font-semibold ${params[p.name] === o.value ? "border-brand bg-brand/10 text-brand" : "border-line"}`}>
                      {o.label}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex gap-2">
                  {p.kind === "int" && <button type="button" className="btn-ghost w-12 px-0" aria-label="Flip sign" onClick={() => flipSign(p.name)}>±</button>}
                  <input
                    id={`p-${p.name}`} className="input" value={params[p.name] ?? ""} placeholder={p.placeholder} autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false}
                    inputMode={p.kind === "int" ? "numeric" : "text"} onFocus={() => setFocus(p.name)}
                    onChange={(e) => setParams((x) => ({ ...x, [p.name]: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && ready && apply({ move: open.id, params, target: activeTarget })}
                  />
                </div>
              )}
            </div>
          ))}
          {open.params.some((p) => p.kind === "term") && (
            <div className="flex flex-wrap gap-1.5" aria-label="Quick keys">
              {["x", "y", "^2", "-", "+", "(", ")"].map((k) => (
                <button key={k} type="button" className="chip min-h-9 min-w-9 justify-center !text-sm" onClick={() => typeInto(k)}>{k === "^2" ? "²" : k === "-" ? "−" : k}</button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn-ghost" onClick={() => { setOpen(null); setNamed(null); }}>Back</button>
            <button type="button" className="btn" disabled={!ready} onClick={() => apply({ move: open.id, params, target: activeTarget })}>Apply</button>
          </div>
        </div>
      ) : (
        <>
          {level === 3 && !(named && shown.length > 0) && (
            <div>
              <label className="label" htmlFor="name-move">Name the move you want to use</label>
              <div className="flex gap-2">
                <input id="name-move" className="input" value={typed} autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder={isExpr ? "e.g. difference of squares" : "e.g. multiply, complement, divide"}
                  onChange={(e) => setTyped(e.target.value)} onKeyDown={(e) => e.key === "Enter" && name()} />
                <button type="button" className="btn" disabled={typed.trim().length < 3} onClick={name}>Use</button>
              </div>
            </div>
          )}
          {shown.length > 0 && (
            <div className="grid grid-cols-2 gap-2" aria-label="Moves">
              {shown.map((o) => (
                <button key={o.key} type="button" onClick={() => choose(o)} className="min-h-12 rounded-xl border-2 border-line bg-white px-2 py-1.5 text-left active:border-brand">
                  <span className="block text-sm font-bold leading-tight">{o.label}</span>
                  {o.hint && <span className="block text-[11px] leading-tight text-muted">{o.hint}</span>}
                </button>
              ))}
            </div>
          )}
          {level === 3 && named && shown.length > 0 && (
            <button type="button" className="text-sm font-semibold text-brand" onClick={() => { setNamed(null); setTyped(""); }}>Name a different move</button>
          )}
          {!isExpr && <button type="button" className="btn w-full" disabled={(cur as StructState).terms.length === 0} onClick={() => apply({ move: "check" })}>Check my structure</button>}
        </>
      )}

      <div className="grid grid-cols-3 gap-2 text-sm">
        <button type="button" className="btn-ghost" disabled={hint >= 3} onClick={() => setHint((h) => Math.min(3, h + 1))}>{hint === 0 ? "Hint" : `Hint ${Math.min(3, hint + 1)}/3`}</button>
        <button type="button" className="btn-ghost" disabled={states.length < 2} onClick={undo}>Undo</button>
        <button type="button" className="btn-ghost" onClick={() => finish("not_sure", line, used, wrong, hint)}>Not sure</button>
      </div>
      <p className="text-xs text-muted">
        {hint > 0 ? "A hint was used, so this card won't count toward mastery. The idea will come back with new numbers." : "\"Not sure\" is free: you'll still see the key idea."}
        {wrong > 0 && ` · ${wrong} move${wrong === 1 ? "" : "s"} rejected`}
      </p>
    </article>
  );
}

"use client";
// The workspace: the on-screen "paper" for one card. The problem sits at the top, every
// locked-in step accumulates below it, and the student performs each step by direct
// manipulation (drag a tile onto a part, drag a term across "=", tap two like terms, drop
// pieces into slots). Every step goes through the module's verifier and gets immediate
// feedback: locked in with a one-line reason, or snapped back with a one-line reason.
//
// There is no multiple choice anywhere on this screen: the toolbox is the same standing
// palette for every card, values come from the keypad or from the student's own expression,
// and support is a highlight on the workspace or a description of the step.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LEVEL_DOWN_ERRORS, LEVEL_UP_CLEAN_STEPS } from "@/lib/engine/config";
import { show, splitSign, toLatex, type Expr } from "@/lib/engine/expr/ast";
import type { ExprState, Target } from "@/lib/engine/expr/state";
import type { Outcome, StepRecord } from "@/lib/engine/progress";
import { moduleOf, nextReferenceStep, type Card } from "@/lib/engine/registry";
import { divOf, structPieces, structValue, template, type StructCard, type StructState } from "@/lib/engine/struct/module";
import type { ApplyResult, MoveDef, MoveInput, ToolGroup } from "@/lib/engine/types";
import { failedStep, guidance, hint as hintFor, problemGoal, type Highlight, type Level } from "@/lib/engine/ui";
import { DragProvider, Piece, Zone, useSetHeld, type DropSpot, type Held } from "./dnd";
import { Keypad, applyKey, type KeySet } from "./Keypad";
import { Tex } from "./Tex";

export interface RunResult {
  outcome: Outcome;
  seconds: number;
  wrongMoves: number;
  hintLevel: number;
  userAnswer: string;
  skippedKeyMove: boolean;
  /** Steps the student took to solve it (for "the long way around"). */
  stepCount: number;
  steps: StepRecord[];
  failedStep?: string;
  workspace: string[];
  endLevel: Level;
}

export const LEVEL_TEXT: Record<Level, string> = {
  1: "Level 1 · guided: the next step is highlighted",
  2: "Level 2 · prompted: you get the goal of each step",
  3: "Level 3 · open: just the goal",
};
const fmt = (s: number) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.max(0, Math.ceil(s)) % 60).padStart(2, "0")}`;
const GROUP_TITLE: Record<ToolGroup, string> = { factor: "Factor", rewrite: "Rewrite", equation: "Equation", mod: "Mod n", build: "Build", join: "Join" };

interface Line { state: unknown; label: string | null; why: string | null; key: boolean; shown: boolean }
type Feedback = { ok: true; text: string; key: boolean; shown?: boolean } | { ok: false; text: string; detail?: string[] };
/** A move waiting for its parameters. */
interface Pending { def: MoveDef; target?: Target; values: Record<string, string>; active: string | null; fixed?: Record<string, string>; title?: string }

export function CardRunner({
  card, level: startLevel, budget, timed, adaptive = true, label, mode = "card", onFinish, onPredictDone,
}: {
  card: Card;
  level: Level;
  budget: number;
  /** Micro-session card: visible timer on the decision step only. */
  timed: boolean;
  /** Move the support level with the student's steps (off when the dial fixes a level). */
  adaptive?: boolean;
  label: string;
  /** "predict": the interactive worked example (untimed, guided, "Show me" reveals each step). */
  mode?: "card" | "predict";
  onFinish?: (r: RunResult) => void;
  onPredictDone?: () => void;
}) {
  const mod = useMemo(() => moduleOf(card), [card]);
  const predict = mode === "predict";
  const [lines, setLines] = useState<Line[]>(() => [{ state: mod.init(card), label: null, why: null, key: false, shown: false }]);
  const [level, setLevel] = useState<Level>(predict ? 1 : startLevel);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [shake, setShake] = useState(0);
  const [pending, setPending] = useState<Pending | null>(null);
  const [rung, setRung] = useState(0); // hint rung shown for the current step
  const [maxHint, setMaxHint] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [decided, setDecided] = useState(false);
  const [done, setDone] = useState(false);
  const [badPart, setBadPart] = useState<number | null>(null);
  const [levelNote, setLevelNote] = useState<string | null>(null);
  const [left, setLeft] = useState(budget);
  const started = useRef(Date.now());
  const finished = useRef(false);
  const step = useRef({ start: Date.now(), wrong: 0, hint: 0 });
  const streak = useRef({ clean: 0, errors: 0 });
  const records = useRef<StepRecord[]>([]);

  const cur = lines[lines.length - 1].state;
  const line = mod.show(cur, card);
  const isExpr = card.module === "expr";
  const showTimer = timed && !predict && !decided && !done;

  const finish = useCallback(
    (outcome: Outcome, ls: Line[]) => {
      if (finished.current || predict) return;
      finished.current = true;
      setDone(true);
      const elapsed = (Date.now() - started.current) / 1000;
      const last = ls[ls.length - 1].state;
      const lastLine = mod.show(last, card);
      const steps = [...records.current];
      if (outcome !== "solved") {
        const next = nextReferenceStep(card, lastLine);
        steps.push({ move: next?.move ?? "?", level, seconds: (Date.now() - step.current.start) / 1000, wrongMoves: step.current.wrong, hintLevel: step.current.hint, result: "unfinished" });
      }
      onFinish?.({
        outcome,
        seconds: outcome === "timeout" ? budget : timed ? Math.min(elapsed, budget) : elapsed,
        wrongMoves: wrong,
        hintLevel: maxHint,
        userAnswer: lastLine || "(nothing yet)",
        skippedKeyMove: outcome === "solved" && !records.current.some((r) => card.keyMoves.includes(r.move)),
        stepCount: records.current.filter((r) => r.move !== "check").length,
        steps,
        failedStep: outcome === "solved" ? undefined : failedStep(card, lastLine, records.current.length),
        workspace: ls.map((l) => mod.show(l.state, card)),
        endLevel: level,
      });
    },
    [budget, card, level, maxHint, mod, onFinish, predict, timed, wrong],
  );

  // Visible countdown for the decision step only (micro-session cards).
  const live = useRef({ lines, finish });
  live.current = { lines, finish };
  useEffect(() => {
    if (!showTimer) return;
    const tick = setInterval(() => {
      const remaining = budget - (Date.now() - started.current) / 1000;
      setLeft(remaining);
      if (remaining <= 0) {
        clearInterval(tick);
        live.current.finish("timeout", live.current.lines);
      }
    }, 250);
    return () => clearInterval(tick);
  }, [budget, showTimer]);

  /** Every step, from any gesture, ends here. */
  function attempt(input: MoveInput, shown = false): boolean {
    if (done) return false;
    const r: ApplyResult<unknown> = mod.apply(card, cur, input);
    setBadPart(null);
    if (!r.ok) {
      setFeedback({ ok: false, text: r.reason, detail: r.detail });
      setShake((n) => n + 1);
      if ("part" in r && typeof r.part === "number") setBadPart(r.part);
      if (!r.noop && !predict) {
        setWrong((w) => w + 1);
        step.current.wrong++;
        streak.current.clean = 0;
        streak.current.errors++;
        if (adaptive && streak.current.errors >= LEVEL_DOWN_ERRORS && level > 1) {
          setLevel((l) => (l - 1) as Level);
          setLevelNote(`More support: Level ${level - 1}.`);
          streak.current.errors = 0;
        }
      }
      return false;
    }
    const key = card.keyMoves.includes(input.move);
    const def = mod.moveDef(input.move);
    const next: Line = { state: r.state, label: input.move === "check" ? "Check" : (def?.name ?? input.move), why: r.why ?? null, key, shown };
    const nextLines = input.move === "check" ? lines : [...lines, next];
    setLines(nextLines);
    setPending(null);
    setFeedback({ ok: true, text: r.why ?? "Correct.", key, shown });
    // Per-step record and the support dial.
    const clean = step.current.wrong === 0 && step.current.hint === 0 && !shown;
    records.current.push({ move: input.move, level, seconds: (Date.now() - step.current.start) / 1000, wrongMoves: step.current.wrong, hintLevel: step.current.hint, result: "ok" });
    step.current = { start: Date.now(), wrong: 0, hint: 0 };
    setRung(0);
    streak.current.errors = 0;
    streak.current.clean = clean ? streak.current.clean + 1 : 0;
    if (!predict && adaptive && streak.current.clean >= LEVEL_UP_CLEAN_STEPS && level < 3) {
      setLevel((l) => (l + 1) as Level);
      setLevelNote(`Clean steps: up to Level ${level + 1}.`);
      streak.current.clean = 0;
    } else setLevelNote(null);
    if (key || r.done || card.path.length === 1) setDecided(true);
    if (r.done) {
      setDone(true);
      if (!predict) finish("solved", nextLines);
    }
    return true;
  }

  function undo() {
    if (lines.length < 2 || done) return;
    setLines((ls) => ls.slice(0, -1));
    setPending(null);
    setFeedback(null);
    setBadPart(null);
  }

  function showMe() {
    const next = nextReferenceStep(card, line);
    if (next) attempt(next, true);
  }

  function startMove(def: MoveDef, target?: Target, fixed?: Record<string, string>, title?: string) {
    setFeedback(null);
    const free = def.params.filter((p) => !fixed || !(p.name in fixed));
    if (!free.length) return attempt({ move: def.id, params: fixed, target });
    const values = Object.fromEntries(free.filter((p) => p.kind === "toggle").map((p) => [p.name, p.on ?? "on"]));
    setPending({ def, target, values, fixed, title, active: free.find((p) => p.kind !== "toggle")?.name ?? null });
  }

  // ---- hints and support -------------------------------------------------------------------
  const guide = done ? null : guidance(card, cur, line, level);
  const hintGuide = rung > 0 && !done ? hintFor(card, cur, line, rung as 1 | 2 | 3) : null;
  const hl: Highlight | null = hintGuide?.highlight ?? guide?.highlight ?? null;
  function takeHint() {
    const r = Math.min(3, rung + 1);
    setRung(r);
    step.current.hint = Math.max(step.current.hint, r);
    if (!predict) setMaxHint((h) => Math.max(h, r));
  }

  const toolbox = mod.toolbox();
  const lowTime = left <= 10;
  // Support and step feedback sit between the workspace and the toolbox, close to the work.
  const status = (
    <>
      {guide && !hintGuide && (
          <p className="rounded-xl bg-brand/5 p-3 text-sm" role="status"><span className="font-semibold">{level === 1 ? "Next: " : "Step goal: "}</span>{guide.text}</p>
        )}
        {hintGuide && <p className="rounded-xl bg-familiar/10 p-3 text-sm" role="status"><span className="font-semibold">Hint {rung}/3:</span> {hintGuide.text}</p>}
        {levelNote && <p className="text-xs font-semibold text-brand">{levelNote}</p>}

        {feedback && (
          <div key={shake} className={`rounded-xl p-3 text-sm ${feedback.ok ? "bg-mastery/10" : "animate-[shake_0.3s] bg-danger/10"}`} role={feedback.ok ? "status" : "alert"}>
            <p className={`font-semibold ${feedback.ok ? "text-mastery" : "text-danger"}`}>
              {feedback.ok ? `${feedback.shown ? "Shown" : "Locked in"}${feedback.key ? " · key move" : ""}. ` : "Snapped back. "}
              <span className="font-normal text-ink">{feedback.text}</span>
            </p>
            {!feedback.ok && feedback.detail?.map((d, i) => <p key={i} className="mt-1">{d}</p>)}
          </div>
        )}
    </>
  );

  return (
    <article className="card space-y-3">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">{label}</p>
          <p className="text-xs text-muted">{predict ? "Worked example: do each step before it's shown" : LEVEL_TEXT[level]}</p>
        </div>
        {showTimer && (
          <div className={`rounded-lg px-2 py-1 font-mono text-lg font-bold tabular-nums ${lowTime ? "bg-danger/10 text-danger" : "bg-canvas"}`} role="timer" aria-label="Time left for this decision">
            {fmt(left)}
          </div>
        )}
      </header>
      {showTimer && (
        <div className="h-1.5 overflow-hidden rounded-full bg-canvas" aria-hidden>
          <div className={`h-full rounded-full ${lowTime ? "bg-danger" : "bg-brand"}`} style={{ width: `${Math.max(0, Math.min(100, (left / budget) * 100))}%` }} />
        </div>
      )}

      <div className="space-y-1">
        <p className="leading-relaxed">{card.prompt}</p>
        <p className="text-xs font-semibold text-muted">{problemGoal(card)}</p>
      </div>

      {isExpr ? (
        <ExprSheet
          card={card} lines={lines} hl={hl} done={done} pending={pending} setPending={setPending}
          startMove={startMove} attempt={attempt} toolbox={toolbox} status={status}
        />
      ) : (
        <StructSheet
          card={card as StructCard} state={cur as StructState} hl={hl} done={done} badPart={badPart} pending={pending} setPending={setPending}
          startMove={startMove} attempt={attempt} toolbox={toolbox} history={lines} status={status}
        />
      )}

      {predict ? (
        done ? (
          <div className="space-y-2">
            {card.why && <p className="text-sm leading-relaxed">{card.why}</p>}
            <p className="rounded-xl bg-mastery/10 p-3 text-sm font-semibold">{card.insight}</p>
            <button type="button" className="btn w-full" onClick={onPredictDone}>Got it, my turn</button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 text-sm">
            <button type="button" className="btn-ghost" onClick={showMe} disabled={!nextReferenceStep(card, line)}>Show me this step</button>
            <button type="button" className="btn-ghost" disabled={lines.length < 2} onClick={undo}>Undo</button>
          </div>
        )
      ) : (
        !done && (
          <>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <button type="button" className="btn-ghost" disabled={rung >= 3} onClick={takeHint}>{rung === 0 ? "Hint" : `Hint ${Math.min(3, rung + 1)}/3`}</button>
              <button type="button" className="btn-ghost" disabled={lines.length < 2} onClick={undo}>Undo</button>
              <button type="button" className="btn-ghost" onClick={() => finish("not_sure", lines)}>Not sure</button>
            </div>
            <p className="text-xs text-muted">
              {maxHint > 0 ? "A hint was used, so this card won't count toward mastery. The idea will come back with new numbers." : "\"Not sure\" is free: it skips to the solution with no penalty."}
              {wrong > 0 && ` · ${wrong} step${wrong === 1 ? "" : "s"} snapped back`}
            </p>
          </>
        )
      )}
    </article>
  );
}

// =========================================================================================
// Module A: the expression sheet
// =========================================================================================
type PartData = { t: "part"; eq?: number; side?: "lhs" | "rhs"; i: number | null; sum: boolean; text: string };
type SpotData =
  | PartData
  | { t: "gap"; eq?: number; side?: "lhs" | "rhs"; pos: number }
  | { t: "side"; eq?: number; side?: "lhs" | "rhs" }
  | { t: "eqsign"; eq: number }
  | { t: "tileSpot"; move: string }
  | { t: "slot"; name: string };
type HeldData = PartData | { t: "tile"; move: string } | { t: "side"; eq?: number; side?: "lhs" | "rhs"; text: string };

const targetOf = (d: { eq?: number; side?: "lhs" | "rhs"; i?: number | null }): Target => ({
  eq: d.eq, side: d.side, ...(typeof d.i === "number" ? { part: d.i } : {}),
});

function ExprSheet({
  card, lines, hl, done, pending, setPending, startMove, attempt, toolbox, status,
}: {
  card: Card; lines: Line[]; hl: Highlight | null; done: boolean; pending: Pending | null; setPending: (p: Pending | null) => void;
  startMove: (def: MoveDef, target?: Target) => void; attempt: (i: MoveInput) => boolean; toolbox: MoveDef[]; status: React.ReactNode;
}) {
  const mod = moduleOf(card);
  const state = lines[lines.length - 1].state as ExprState;

  const accepts = useCallback((h: Held, s: DropSpot) => {
    const a = h.data as HeldData;
    const b = s.data as SpotData;
    if (b.t === "slot") return a.t !== "tile";
    if (a.t === "tile") return b.t === "part" || b.t === "side" || b.t === "eqsign";
    if (b.t === "tileSpot") return true;
    if (a.t === "side") return false;
    // A part held: combine, regroup, or move it across "=".
    if (a.eq !== (b as { eq?: number }).eq) return false;
    if (b.t === "part") return b.side === a.side ? a.sum && b.sum && b.i !== a.i : state.kind === "eqs" && (a.sum || a.i === null);
    if (b.t === "gap") return b.side === a.side && a.sum;
    if (b.t === "side" || b.t === "eqsign") return state.kind === "eqs" && (b.t === "eqsign" || b.side !== a.side) && (a.sum || a.i === null);
    return false;
  }, [state.kind]);

  const onDrop = useCallback((h: Held, s: DropSpot) => {
    const a = h.data as HeldData;
    const b = s.data as SpotData;
    if (b.t === "slot") {
      if (a.t === "tile" || !pending) return;
      setPending({ ...pending, values: { ...pending.values, [b.name]: a.text }, active: b.name });
      return;
    }
    if (a.t === "tile") {
      const def = mod.moveDef(a.move)!;
      if (b.t === "part") return startMove(def, targetOf(b));
      if (b.t === "side") return startMove(def, { eq: b.eq, side: b.side });
      if (b.t === "eqsign") return startMove(def, { eq: b.eq, side: "lhs" });
      return;
    }
    if (b.t === "tileSpot") return startMove(mod.moveDef(b.move)!, targetOf(a));
    if (a.t !== "part") return;
    const at = { eq: a.eq, side: a.side };
    if (b.t === "part" && b.side === a.side) return void attempt({ move: "combine", params: { i: String(a.i), j: String(b.i) }, target: at });
    if (b.t === "gap") return void attempt({ move: "reorder", params: { i: String(a.i), to: String(b.pos) }, target: at });
    return void attempt({ move: "move_across", params: { i: String(a.i ?? 0) }, target: at });
  }, [attempt, mod, pending, setPending, startMove]);

  return (
    <DragProvider onDrop={onDrop} accepts={accepts}>
      {/* Sticky, so the line stays in view while a tool is dragged up from the toolbox. */}
      <div className="sticky top-0 z-10 max-h-[45vh] overflow-y-auto rounded-xl bg-canvas p-3 shadow-sm">
        {/* Worked lines: the solution builds up like a page of working. */}
        <ol className="space-y-1" aria-label="Your working">
          {lines.slice(0, -1).map((l, i) => {
            const nextL = lines[i + 1];
            return (
              <li key={i} className="text-sm">
                <Tex latex={stateLatex(l.state as ExprState)} className="text-muted" />
                <p className={`ml-3 border-l-2 pl-2 text-xs ${nextL.key ? "border-familiar" : "border-mastery"}`}>
                  <span className="font-semibold">{nextL.shown ? "Shown: " : "✓ "}{nextL.label}</span>
                  {nextL.key && <span className="ml-1 rounded bg-familiar/20 px-1 font-bold uppercase">key move</span>}
                  {nextL.why && <span className="text-muted"> · {nextL.why}</span>}
                </p>
              </li>
            );
          })}
        </ol>
        <div className={`mt-2 text-xl ${lines.length > 1 ? "border-t border-line pt-2" : ""}`} aria-live="polite">
          <CurrentLine state={state} hl={hl} done={done} />
        </div>
      </div>
      {status}

      {pending ? (
        <ParamTray pending={pending} setPending={setPending} onApply={() => attempt({ move: pending.def.id, params: { ...pending.values, ...pending.fixed }, target: pending.target })} />
      ) : (
        !done && <Toolbox tools={toolbox} hl={hl} help="Drag a tool onto the part it acts on, or tap a tool and then tap the part. Drop it on the = sign to use it on an equation. Drag a term across = to move it; drop a term on a like term to combine them." />
      )}
    </DragProvider>
  );
}

function stateLatex(s: ExprState): string {
  const sub = s.kind !== "mod" && s.sub ? `\\quad\\text{where } ${s.sub.name} = ${toLatex(s.sub.expr)}` : "";
  if (s.kind === "expr") return toLatex(s.expr) + sub;
  if (s.kind === "mod") return `${toLatex(s.expr)} \\pmod{${s.mod}}`;
  return s.eqs.map((e) => `${toLatex(e.lhs)} = ${toLatex(e.rhs)}`).join("\\ \\text{ or }\\ ") + sub;
}

const isHl = (hl: Highlight | null, eq: number | undefined, side: "lhs" | "rhs" | undefined) =>
  !!hl && (hl.eq ?? 0) === (eq ?? 0) && (hl.side ?? "lhs") === (side ?? "lhs");
const HL = "bg-familiar/25 ring-2 ring-familiar";

function CurrentLine({ state, hl, done }: { state: ExprState; hl: Highlight | null; done: boolean }) {
  if (state.kind === "mod") {
    return (
      <Zone spot={{ id: "side:0:lhs", data: { t: "side" } }} label="The whole line" className={`inline-flex items-center gap-2 rounded-lg p-1 ${hl ? HL : ""}`}>
        <Tex latex={`${toLatex(state.expr)} \\pmod{${state.mod}}`} />
      </Zone>
    );
  }
  const sub = state.sub ? <p className="mt-1 text-sm text-familiar">where <Tex latex={`${state.sub.name} = ${toLatex(state.sub.expr)}`} /></p> : null;
  if (state.kind === "expr") {
    return (
      <div>
        <SideView expr={state.expr} hl={isHl(hl, undefined, undefined) ? hl : null} done={done} />
        {sub}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {state.eqs.map((eq, i) => (
        <div key={i} className="flex flex-wrap items-center gap-1">
          {i > 0 && <span className="mr-1 text-sm text-muted">or</span>}
          <SideView expr={eq.lhs} eq={i} side="lhs" hl={isHl(hl, i, "lhs") ? hl : null} done={done} />
          <Piece spot={{ id: `eq:${i}`, data: { t: "eqsign", eq: i } }} label="Equals sign: drop a move here to use it on the equation" className="min-h-11 min-w-9 rounded-lg px-1 text-xl font-bold" disabled={done}>
            =
          </Piece>
          <SideView expr={eq.rhs} eq={i} side="rhs" hl={isHl(hl, i, "rhs") ? hl : null} done={done} />
        </div>
      ))}
      {sub}
    </div>
  );
}

/** One side: each top-level term (of a sum) or factor (of a product) is its own piece. */
function SideView({ expr, eq, side, hl, done }: { expr: Expr; eq?: number; side?: "lhs" | "rhs"; hl: Highlight | null; done: boolean }) {
  const setHeld = useSetHeld();
  const key = `${eq ?? 0}:${side ?? "lhs"}`;
  const sum = expr.k === "add";
  const parts: Expr[] = expr.k === "add" ? expr.terms : expr.k === "mul" ? expr.factors : [expr];
  const whole = parts.length === 1;
  const wholeHl = !!hl && !hl.parts;
  const sideItem: Held = { id: `sideItem:${key}`, label: show(expr), data: { t: "side", eq, side, text: show(expr) } };
  const piece = "inline-flex min-h-11 items-center rounded-lg px-1.5";
  return (
    <Zone
      spot={{ id: `side:${key}`, data: { t: "side", eq, side } }}
      label={side ? `${side === "lhs" ? "Left" : "Right"} side${eq ? ` of equation ${eq + 1}` : ""}` : "The whole expression"}
      onTapEmpty={done ? undefined : () => setHeld(sideItem)}
      className={`inline-flex flex-wrap items-center rounded-xl border border-dashed border-line px-1 py-0.5 ${wholeHl ? HL : ""}`}
    >
      {parts.map((p, i) => {
        const [minus, body] = sum ? splitSign(p) : [false, p];
        const latex = sum ? toLatex(body) : expr.k === "mul" && (p.k === "add" || p.k === "neg" || p.k === "div") ? `\\left(${toLatex(p)}\\right)` : toLatex(p);
        const data: PartData = { t: "part", eq, side, i: whole ? null : i, sum, text: show(p) };
        const lit = !!hl?.parts?.includes(i);
        return (
          <span key={i} className="inline-flex items-center">
            {sum && (
              <Piece spot={{ id: `gap:${key}:${i}`, data: { t: "gap", eq, side, pos: i } }} label={`Place before term ${i + 1}`} className="min-h-11 min-w-4 rounded px-0.5 text-lg" disabled={done}>
                {i === 0 ? (minus ? "−" : "") : minus ? "−" : "+"}
              </Piece>
            )}
            <Piece
              item={done ? undefined : { id: `part:${key}:${i}`, label: show(p), data }}
              spot={{ id: `partSpot:${key}:${i}`, data }}
              label={show(p)}
              className={`${piece} ${lit ? HL : "bg-white"} border border-line`}
              disabled={done}
            >
              <Tex latex={latex} />
            </Piece>
          </span>
        );
      })}
      {sum && (
        <Piece spot={{ id: `gap:${key}:${parts.length}`, data: { t: "gap", eq, side, pos: parts.length } }} label="Place at the end" className="min-h-11 min-w-4 rounded" disabled={done}>
          <span aria-hidden> </span>
        </Piece>
      )}
    </Zone>
  );
}

// =========================================================================================
// The standing toolbox (both modules) and the parameter tray
// =========================================================================================
function Toolbox({ tools, hl, help }: { tools: MoveDef[]; hl: Highlight | null; help: string }) {
  const groups = [...new Set(tools.map((t) => t.group!))];
  return (
    <section aria-label="Toolbox" className="space-y-2">
      <p className="text-xs text-muted">{help}</p>
      {groups.map((g) => (
        <div key={g}>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{GROUP_TITLE[g]}</p>
          <div className="flex flex-wrap gap-1.5">
            {tools.filter((t) => t.group === g).map((t) => (
              <Piece
                key={t.id}
                item={{ id: `tile:${t.id}`, label: t.name, data: { t: "tile", move: t.id } }}
                spot={{ id: `tileSpot:${t.id}`, data: { t: "tileSpot", move: t.id } }}
                label={t.name}
                className={`min-h-11 rounded-xl border-2 px-2 py-1 text-left text-[13px] font-semibold leading-tight ${hl?.tile === t.id ? "border-familiar bg-familiar/15" : "border-line bg-white"}`}
              >
                {t.name}
              </Piece>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function slotText(v: string): string {
  return v.replace(/-/g, "−").replace(/\^2/g, "²").replace(/\*/g, "·");
}

function ParamTray({ pending, setPending, onApply, keys }: { pending: Pending; setPending: (p: Pending | null) => void; onApply: () => void; keys?: KeySet }) {
  const free = pending.def.params.filter((p) => !pending.fixed || !(p.name in pending.fixed));
  const active = free.find((p) => p.name === pending.active);
  const ready = free.every((p) => p.kind === "toggle" || (pending.values[p.name] ?? "").trim() !== "");
  const set = keys ?? (active?.kind === "int" ? "int" : "term");
  return (
    <section className="space-y-2 rounded-xl border border-brand/40 p-3" aria-label={`${pending.def.name}: fill in`}>
      <p className="font-semibold">{pending.title ?? pending.def.name}</p>
      <p className="text-xs text-muted">{pending.def.blurb}{free.some((p) => p.kind === "term") ? " Drag a piece of your expression into a slot, or type it." : ""}</p>
      {free.map((p) =>
        p.kind === "toggle" ? (
          <button key={p.name} type="button" role="switch" aria-checked={pending.values[p.name] === p.on}
            onClick={() => setPending({ ...pending, values: { ...pending.values, [p.name]: pending.values[p.name] === p.on ? (p.off ?? "") : (p.on ?? "") } })}
            className="flex min-h-11 w-full items-center justify-between rounded-xl border border-line px-3 text-sm">
            <span>{p.label}</span>
            <span className={`h-6 w-11 rounded-full p-0.5 ${pending.values[p.name] === p.on ? "bg-brand" : "bg-line"}`}>
              <span className={`block h-5 w-5 rounded-full bg-white transition ${pending.values[p.name] === p.on ? "translate-x-5" : ""}`} />
            </span>
          </button>
        ) : (
          <div key={p.name}>
            <p className="label">{p.label}</p>
            <Piece
              spot={{ id: `slot:${p.name}`, data: { t: "slot", name: p.name } }}
              label={`${p.label}: ${pending.values[p.name] || "empty"}`}
              onTapEmpty={() => setPending({ ...pending, active: p.name })}
              className={`flex min-h-12 w-full items-center rounded-xl border-2 px-3 text-left text-lg font-semibold ${pending.active === p.name ? "border-brand" : "border-dashed border-line"}`}
            >
              {pending.values[p.name] ? slotText(pending.values[p.name]) : <span className="text-sm font-normal text-muted">{p.placeholder ? `e.g. ${slotText(p.placeholder)}` : "empty"}</span>}
            </Piece>
          </div>
        ),
      )}
      {active && <Keypad set={set} onKey={(k) => setPending({ ...pending, values: { ...pending.values, [active.name]: applyKey(pending.values[active.name] ?? "", k) } })} />}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn-ghost" onClick={() => setPending(null)}>Cancel</button>
        <button type="button" className="btn" disabled={!ready} onClick={onApply}>Apply</button>
      </div>
    </section>
  );
}

// =========================================================================================
// Module B: the structure canvas
// =========================================================================================
type SHeld = { t: "piece"; id: string; text: string } | { t: "tile"; move: string };
type SSpot = { t: "part"; index: number } | { t: "canvas" } | { t: "pendingSlot" };

function StructSheet({
  card, state, hl, done, badPart, pending, setPending, startMove, attempt, toolbox, history, status,
}: {
  card: StructCard; state: StructState; hl: Highlight | null; done: boolean; badPart: number | null; pending: Pending | null; setPending: (p: Pending | null) => void;
  startMove: (def: MoveDef, target?: Target, fixed?: Record<string, string>, title?: string) => void; attempt: (i: MoveInput) => boolean; toolbox: MoveDef[]; history: Line[]; status: React.ReactNode;
}) {
  const t = template(card.template);
  const pieces = structPieces(card);
  const [emptySlot, setEmptySlot] = useState(false);
  const active = state.terms.length - 1;
  const slotDef = useMemo(() => toolbox.find((m) => m.id === "slot")!, [toolbox]);
  const mod = moduleOf(card);

  const placePiece = (id: string) => {
    setEmptySlot(false);
    const piece = pieces.find((p) => p.id === id)!;
    startMove(slotDef, undefined, { slot: id }, `How many options for "${piece.label}"?`);
  };

  const accepts = useCallback((h: Held, s: DropSpot) => {
    const a = h.data as SHeld;
    const b = s.data as SSpot;
    if (a.t === "piece") return b.t === "pendingSlot" || b.t === "canvas" || (b.t === "part" && b.index === active);
    if (a.move === "slot" || a.move === "divide") return (b.t === "part" && b.index === active) || (b.t === "canvas" && active < 0 && a.move === "slot");
    return b.t === "canvas" || b.t === "part";
  }, [active]);

  const onDrop = useCallback((h: Held, s: DropSpot) => {
    const a = h.data as SHeld;
    if (a.t === "piece") return placePiece(a.id);
    if (a.move === "slot") return setEmptySlot(true);
    const def = mod.moveDef(a.move)!;
    startMove(def, undefined, undefined, a.move === "divide" ? "Divide this part by how many?" : undefined);
    void s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mod, startMove, active]);

  const complete = state.terms.length > 0 && state.terms.every((x) => x.slots.length);
  return (
    <DragProvider onDrop={onDrop} accepts={accepts}>
      <section aria-label="Pieces of this problem" className="space-y-1">
        <p className="text-xs text-muted">Pieces: drag one into a slot (or tap it, then tap the slot). You type how many options it has.</p>
        <div className="flex flex-wrap gap-1.5">
          {pieces.map((p) => (
            <Piece key={p.id} item={done ? undefined : { id: `piece:${p.id}`, label: p.label, data: { t: "piece", id: p.id, text: p.label } }} label={p.label} disabled={done}
              className={`min-h-11 max-w-full rounded-xl border-2 px-2.5 py-1 text-left text-sm ${hl?.piece === p.id ? "border-familiar bg-familiar/15" : "border-line bg-white"}`}>
              {p.label}
            </Piece>
          ))}
        </div>
      </section>

      <Zone spot={{ id: "canvas", data: { t: "canvas" } }} label="Structure canvas" className="sticky top-0 z-10 block min-h-24 rounded-xl bg-canvas p-3 shadow-sm">
        {state.terms.length === 0 && !emptySlot && <p className="text-sm text-muted">Empty canvas. Drop the first piece here.</p>}
        <div className="space-y-2">
          {state.terms.map((term, i) => (
            <Zone key={i} spot={{ id: `part:${i}`, data: { t: "part", index: i } }} label={`Part ${i + 1}${i === active ? " (active)" : ""}`}
              className={`flex flex-wrap items-start gap-1.5 rounded-lg p-1 ${badPart === i ? "ring-2 ring-danger bg-danger/5" : i === active && !done ? "ring-1 ring-brand/30" : ""}`}>
              {(i > 0 || term.sign < 0) && <span className="mt-1 text-xl font-bold">{term.sign < 0 ? "−" : "+"}</span>}
              {term.slots.length === 0 && i === active && !emptySlot && <span className="mt-1.5 text-sm text-muted">new part: drop a piece</span>}
              {term.slots.map((id, j) => {
                const slot = t.slots.find((s) => s.id === id)!;
                return (
                  <span key={j} className="flex max-w-[9rem] flex-col rounded-lg border border-line bg-white px-2 py-1">
                    <span className="text-lg font-bold leading-tight">{j > 0 && "× "}{slot.count(card.full, j)}</span>
                    <span className="text-[11px] leading-tight text-muted">{slot.label(card.full)}</span>
                  </span>
                );
              })}
              {i === active && emptySlot && <PendingSlot />}
              {term.div && (
                <span className="flex max-w-[9rem] flex-col rounded-lg border border-familiar/60 bg-familiar/10 px-2 py-1">
                  <span className="text-lg font-bold leading-tight">÷ {divOf(t, term.div).value(card.full)}</span>
                </span>
              )}
            </Zone>
          ))}
          {state.terms.length === 0 && emptySlot && <PendingSlot />}
        </div>
        {complete && <p className="mt-2 text-lg font-semibold">= {structValue(card, state)}</p>}
      </Zone>
      <ol className="sr-only">{history.slice(1).map((l, i) => <li key={i}>{l.label}</li>)}</ol>
      {status}

      {pending ? (
        <ParamTray pending={pending} setPending={(p) => { setPending(p); if (!p) setEmptySlot(false); }} keys="count"
          onApply={() => { if (attempt({ move: pending.def.id, params: { ...pending.values, ...pending.fixed } })) setEmptySlot(false); }} />
      ) : (
        !done && (
          <>
            <Toolbox tools={toolbox} hl={hl} help="× Multiply adds an empty slot; + Case and − Complement start a new part; ÷ Symmetry divides the active part. Drag a token onto the canvas, or tap it and then tap the canvas." />
            <button type="button" className="btn w-full" disabled={!complete} onClick={() => attempt({ move: "check" })}>Check my structure</button>
          </>
        )
      )}
    </DragProvider>
  );
}

function PendingSlot() {
  return (
    <Piece spot={{ id: "pendingSlot", data: { t: "pendingSlot" } }} label="Empty slot: drop a piece here" className="min-h-14 min-w-20 rounded-lg border-2 border-dashed border-brand/60 px-2 text-sm text-muted">
      drop a piece
    </Piece>
  );
}

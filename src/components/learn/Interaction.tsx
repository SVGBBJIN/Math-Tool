"use client";
// The answer area of a card, one component per interaction kind. Controlled: the card
// owns the response and decides when to check it.
import { useMemo } from "react";
import { parseExpr, show } from "@/lib/learn/math/ast";
import type { Card, Interaction as I, Response } from "@/lib/learn/cards/types";
import { FigureView } from "./FigureView";
import { Rich } from "./Rich";

export function emptyResponse(i: I): Response {
  switch (i.kind) {
    case "numeric": return { kind: "numeric", text: "" };
    case "expression": return { kind: "expression", text: "" };
    case "choice": return { kind: "choice", id: "" };
    case "multi": return { kind: "multi", ids: [] };
    case "order": return { kind: "order", ids: [] };
    case "blanks": return { kind: "blanks", values: i.blanks.map(() => "") };
    case "tap": return { kind: "tap", ids: [] };
    case "explain": return { kind: "explain", text: "", covered: [] };
  }
}

/** Something has been entered, so "Check" makes sense. */
export function hasAnswer(r: Response): boolean {
  switch (r.kind) {
    case "numeric": case "expression": return r.text.trim().length > 0;
    case "choice": return !!r.id;
    case "multi": case "tap": return r.ids.length > 0;
    case "order": return r.ids.length > 0;
    case "blanks": return r.values.every((v) => v.trim());
    case "explain": return r.text.trim().length >= 12;
  }
}

/** Stable shuffle, so the order of steps does not jump around between renders. */
function shuffled<T extends { id: string }>(items: T[], seed: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    const j = (h >>> 0) % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  if (out.every((o, k) => o.id === items[k].id)) out.push(out.shift()!);
  return out;
}

function ExpressionPreview({ text }: { text: string }) {
  const read = useMemo(() => {
    if (!text.trim()) return null;
    try { return show(parseExpr(text)); } catch { return ""; }
  }, [text]);
  if (read === null) return <p className="mt-2 text-xs text-muted">Type ^ for powers, like 3x^2. Brackets and implied multiplication are fine.</p>;
  return <p className="mt-2 text-sm text-muted">{read ? <>Reads as <span className="math text-ink">{read}</span></> : "Not readable yet."}</p>;
}

export function Interaction({ card, value, onChange, onSubmit, locked, parts }: {
  card: Card;
  value: Response;
  onChange: (r: Response) => void;
  onSubmit: () => void;
  /** After the answer is final: show, don't edit. */
  locked: boolean;
  /** For blanks after checking: which were right. */
  parts?: boolean[];
}) {
  const i = card.interaction;
  const enter = (e: React.KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSubmit(); } };

  switch (i.kind) {
    case "numeric": {
      const v = value as Extract<Response, { kind: "numeric" }>;
      return (
        <div className="flex items-center gap-3">
          <input className="answer-input max-w-56" inputMode="text" autoComplete="off" spellCheck={false} aria-label="Your answer" placeholder="Answer" disabled={locked}
            value={v.text} onChange={(e) => onChange({ kind: "numeric", text: e.target.value })} onKeyDown={enter} />
          {i.unit && <span className="text-lg text-muted">{i.unit}</span>}
        </div>
      );
    }
    case "expression": {
      const v = value as Extract<Response, { kind: "expression" }>;
      return (
        <div>
          <input className="answer-input" autoComplete="off" autoCapitalize="off" spellCheck={false} aria-label="Your expression" placeholder={i.form === "factored" ? "e.g. 2x(x+3)" : "Expression"} disabled={locked}
            value={v.text} onChange={(e) => onChange({ kind: "expression", text: e.target.value })} onKeyDown={enter} />
          {!locked && <ExpressionPreview text={v.text} />}
        </div>
      );
    }
    case "choice": {
      const v = value as Extract<Response, { kind: "choice" }>;
      return (
        <div role="radiogroup" className="space-y-2">
          {i.options.map((o) => {
            const tone = locked ? (o.id === i.answer ? "!border-apply !bg-apply/5" : o.id === v.id ? "!border-danger/60" : "opacity-60") : "";
            return (
              <button key={o.id} type="button" role="radio" aria-checked={v.id === o.id} disabled={locked} className={`option ${tone}`} onClick={() => onChange({ kind: "choice", id: o.id })}>
                <span className={`h-4 w-4 shrink-0 rounded-full border-2 ${v.id === o.id ? "border-brand bg-brand" : "border-line"}`} aria-hidden />
                <Rich text={o.text} />
              </button>
            );
          })}
        </div>
      );
    }
    case "multi": {
      const v = value as Extract<Response, { kind: "multi" }>;
      const toggle = (id: string) => onChange({ kind: "multi", ids: v.ids.includes(id) ? v.ids.filter((x) => x !== id) : [...v.ids, id] });
      return (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Select all that apply</p>
          {i.options.map((o) => {
            const on = v.ids.includes(o.id);
            const right = i.answers.includes(o.id);
            return (
              <div key={o.id}>
                <button type="button" role="checkbox" aria-checked={on} disabled={locked} onClick={() => toggle(o.id)}
                  className={`option ${locked ? (right ? "!border-apply !bg-apply/5" : on ? "!border-danger/60" : "opacity-60") : ""}`}>
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 text-xs text-white ${on ? "border-brand bg-brand" : "border-line"}`} aria-hidden>{on ? "✓" : ""}</span>
                  <Rich text={o.text} />
                </button>
                {locked && o.feedback && (on || right) && <p className="mt-1 px-2 text-sm text-muted"><Rich text={o.feedback} /></p>}
              </div>
            );
          })}
        </div>
      );
    }
    case "order": {
      const v = value as Extract<Response, { kind: "order" }>;
      const pool = shuffled(i.items, card.id).filter((o) => !v.ids.includes(o.id));
      const byId = new Map(i.items.map((o) => [o.id, o]));
      return (
        <div className="space-y-3">
          <ol className="space-y-2" aria-label="Your order">
            {v.ids.map((id, k) => (
              <li key={id}>
                <button type="button" disabled={locked} onClick={() => onChange({ kind: "order", ids: v.ids.filter((x) => x !== id) })}
                  className={`option ${locked ? (i.items[k]?.id === id ? "!border-apply !bg-apply/5" : "!border-danger/60") : "border-brand/50"}`} aria-label={`Step ${k + 1}. Tap to remove.`}>
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-white">{k + 1}</span>
                  <Rich text={byId.get(id)!.text} />
                </button>
              </li>
            ))}
            {!locked && v.ids.length < i.items.length && (
              <li className="rounded-2xl border-2 border-dashed border-line px-4 py-3 text-sm text-muted">Tap the step that comes {v.ids.length ? "next" : "first"}</li>
            )}
          </ol>
          {!locked && (
            <div className="space-y-2">
              {pool.map((o) => (
                <button key={o.id} type="button" className="option" onClick={() => onChange({ kind: "order", ids: [...v.ids, o.id] })}><Rich text={o.text} /></button>
              ))}
            </div>
          )}
        </div>
      );
    }
    case "blanks": {
      const v = value as Extract<Response, { kind: "blanks" }>;
      const pieces = i.text.split(/\{\{(\d+)\}\}/);
      return (
        <p className="prose-card rounded-2xl bg-canvas p-4 leading-loose">
          {pieces.map((piece, k) => {
            if (k % 2 === 0) return <Rich key={k} text={piece} />;
            const n = Number(piece);
            const tone = parts ? (parts[n] ? "!border-apply" : "!border-danger") : "";
            return (
              <input key={k} className={`blank-input ${tone}`} inputMode="text" autoComplete="off" aria-label={`Blank ${n + 1}`} disabled={locked} value={v.values[n]}
                onChange={(e) => onChange({ kind: "blanks", values: v.values.map((x, j) => (j === n ? e.target.value : x)) })} onKeyDown={enter} />
            );
          })}
        </p>
      );
    }
    case "tap": {
      const v = value as Extract<Response, { kind: "tap" }>;
      if (!card.figure) return null;
      return (
        <div>
          <FigureView figure={card.figure} selected={v.ids} reveal={locked ? i.answers : undefined}
            onToggle={locked ? undefined : (id) => onChange({ kind: "tap", ids: v.ids.includes(id) ? v.ids.filter((x) => x !== id) : [...v.ids, id] })} />
          <p className="text-center text-xs text-muted">{locked ? "Green: the right angles" : `${v.ids.length} selected · tap again to unselect`}</p>
        </div>
      );
    }
    case "explain": {
      const v = value as Extract<Response, { kind: "explain" }>;
      return (
        <textarea className="input min-h-32 text-base" placeholder={i.placeholder} disabled={locked} value={v.text} aria-label="Your explanation"
          onChange={(e) => onChange({ ...v, text: e.target.value })} />
      );
    }
  }
}

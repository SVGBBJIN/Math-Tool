// Interaction validation: decides whether a response is right, and says something useful
// about the mathematics either way. Pure; no React, no progress.
import { ParseError, gcd, parseExpr, show, varsOf, type Expr } from "../math/ast";
import { coeffs, fAdd, fMul, fr, pDegree, pEq, pVars, toPoly, tryPoly, type Poly } from "../math/poly";
import { parseRational, rEq, rShow } from "../math/rational";
import type { Card, Interaction, KnownSlip, Response } from "./types";

export interface CheckResult {
  /** invalid = could not be read as an answer at all; it is not counted as an attempt. */
  status: "correct" | "incorrect" | "invalid";
  message: string;
  /** For `blanks`: which blanks were right. */
  parts?: boolean[];
  /** The student judged their own answer (explain cards). Weaker evidence than a checked answer. */
  selfReported?: boolean;
}

// ---- expressions ------------------------------------------------------------------
function factorsOf(e: Expr): Expr[] {
  if (e.k === "mul") return e.factors.flatMap(factorsOf);
  if (e.k === "pow") return factorsOf(e.base);
  if (e.k === "neg") return factorsOf(e.arg);
  return varsOf(e).size ? [e] : [];
}
const isSquare = (n: number) => n >= 0 && Number.isInteger(Math.sqrt(n));
/** Why a factor is not finished, or null if it is irreducible over the rationals. */
function reducible(f: Expr): string | null {
  const p = toPoly(f);
  const cs = [...p.values()];
  if (cs.some((c) => c.d !== 1)) return "has fractional coefficients";
  if (cs.reduce((g, c) => gcd(g, c.n), 0) !== 1) return "still has a common numeric factor";
  const deg = pDegree(p);
  if (deg <= 1) return null;
  const names = pVars(p);
  if (names.length !== 1) return p.size > 1 ? "may factor further" : null;
  const c = coeffs(p, names[0])!;
  if (c[0].n === 0) return `still has a factor of ${names[0]} inside`;
  if (deg === 2) {
    const disc = fAdd(fMul(c[1], c[1]), fMul(fr(-4), fMul(c[2], c[0])));
    return isSquare(disc.n) && isSquare(disc.d) ? "still factors" : null;
  }
  return "may factor further";
}
/** Null when `e` is a complete factorisation; otherwise what is left to do. */
export function unfactored(e: Expr): string | null {
  const factors = factorsOf(e);
  for (const f of factors) {
    const why = reducible(f);
    if (why) return `${show(f)} ${why}`;
  }
  return null;
}

function readPoly(text: string, vars: string[]): { expr: Expr; poly: Poly } | string {
  let expr: Expr;
  try {
    expr = parseExpr(text);
  } catch (e) {
    return e instanceof ParseError ? `I couldn't read that expression (${e.message.toLowerCase()}). Write powers as x^2.` : "I couldn't read that expression.";
  }
  const extra = [...varsOf(expr)].filter((v) => !vars.includes(v));
  if (extra.length) return `This should only use ${vars.join(", ")}.`;
  const poly = tryPoly(expr);
  return poly ? { expr, poly } : "Use only +, −, × and whole-number powers here.";
}

export function expressionsEqual(a: string, b: string): boolean {
  const [pa, pb] = [tryPoly(parseExpr(a)), tryPoly(parseExpr(b))];
  return !!pa && !!pb && pEq(pa, pb);
}

// ---- numbers ----------------------------------------------------------------------
function numbersEqual(a: string, b: string): boolean {
  const [x, y] = [parseRational(a), parseRational(b)];
  return !!x && !!y && rEq(x, y);
}
const slipFor = (slips: KnownSlip[] | undefined, same: (answer: string) => boolean) => slips?.find((s) => same(s.answer))?.feedback;

const sameSet = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join("\u0000") === [...b].sort().join("\u0000");

/** The key in a form a student would recognise, for the reveal and the misses log. */
export function answerText(card: Card): string {
  const i = card.interaction;
  const optionText = (options: { id: string; text: string }[], id: string) => options.find((o) => o.id === id)?.text ?? id;
  switch (i.kind) {
    case "numeric": return i.answer + (i.unit ? ` ${i.unit}` : "");
    case "expression": return show(parseExpr(i.answer));
    case "choice": return optionText(i.options, i.answer);
    case "multi": return i.answers.map((id) => optionText(i.options, id)).join("; ");
    case "order": return i.items.map((o, k) => `${k + 1}. ${o.text}`).join(" ");
    case "blanks": return i.blanks.map((b) => b.answer).join(", ");
    case "tap": {
      const names = new Map((card.figure?.items ?? []).flatMap((it) => (it.t === "target" ? [[it.id, it.name] as [string, string]] : [])));
      return i.answers.map((id) => names.get(id) ?? id).join(", ");
    }
    case "explain": return i.model;
  }
}

/** What the student answered, in words, for the misses log. */
export function responseText(card: Card, r: Response): string {
  const i = card.interaction;
  const optionText = (id: string) => ("options" in i ? i.options : "items" in i ? i.items : []).find((o) => o.id === id)?.text ?? id;
  switch (r.kind) {
    case "numeric": case "expression": return r.text.trim();
    case "choice": return optionText(r.id);
    case "multi": return r.ids.map(optionText).join("; ") || "nothing selected";
    case "order": return r.ids.map(optionText).join(" → ");
    case "blanks": return r.values.map((v) => v.trim() || "–").join(", ");
    case "tap": {
      const names = new Map((card.figure?.items ?? []).flatMap((it) => (it.t === "target" ? [[it.id, it.name] as [string, string]] : [])));
      return r.ids.map((id) => names.get(id) ?? id).join(", ") || "nothing selected";
    }
    case "explain": return r.text.trim();
  }
}

export function check(card: Card, response: Response): CheckResult {
  const i: Interaction = card.interaction;
  if (i.kind !== response.kind) return { status: "invalid", message: "That answer doesn't match this card." };
  const right: CheckResult = { status: "correct", message: card.feedback.correct };
  const wrong = (specific?: string): CheckResult => ({ status: "incorrect", message: specific ?? card.feedback.incorrect });

  switch (i.kind) {
    case "numeric": {
      const r = response as Extract<Response, { kind: "numeric" }>;
      const value = parseRational(r.text);
      if (!value) return { status: "invalid", message: r.text.trim() ? "Enter a number, like 42, −3 or 5/8." : "Type your answer first." };
      if (numbersEqual(r.text, i.answer)) return right;
      return wrong(slipFor(i.slips, (a) => numbersEqual(a, rShow(value))));
    }
    case "expression": {
      const r = response as Extract<Response, { kind: "expression" }>;
      if (!r.text.trim()) return { status: "invalid", message: "Type your answer first." };
      const got = readPoly(r.text, i.vars);
      if (typeof got === "string") return { status: "invalid", message: got };
      const want = toPoly(parseExpr(i.answer));
      if (!pEq(got.poly, want)) return wrong(slipFor(i.slips, (a) => pEq(toPoly(parseExpr(a)), got.poly)));
      if (i.form === "factored") {
        if (got.expr.k === "add") return wrong("That is equal to the original, but it is still a sum. Factoring means writing it as a product.");
        const left = unfactored(got.expr);
        if (left) return wrong(`That is equal to the original, but ${left}. Keep going until no bracket can be split.`);
      }
      return right;
    }
    case "choice": {
      const r = response as Extract<Response, { kind: "choice" }>;
      const picked = i.options.find((o) => o.id === r.id);
      if (!picked) return { status: "invalid", message: "Pick one of the options." };
      return picked.id === i.answer ? { status: "correct", message: picked.feedback ?? card.feedback.correct } : wrong(picked.feedback);
    }
    case "multi": {
      const r = response as Extract<Response, { kind: "multi" }>;
      if (!r.ids.length) return { status: "invalid", message: "Select at least one." };
      if (sameSet(r.ids, i.answers)) return right;
      const extra = r.ids.map((id) => i.options.find((o) => o.id === id)).find((o) => o && !i.answers.includes(o.id));
      if (extra?.feedback) return wrong(extra.feedback);
      const missed = i.options.find((o) => i.answers.includes(o.id) && !r.ids.includes(o.id));
      return wrong(missed?.feedback);
    }
    case "order": {
      const r = response as Extract<Response, { kind: "order" }>;
      if (!sameSet(r.ids, i.items.map((o) => o.id))) return { status: "invalid", message: "Place every step." };
      const firstOff = i.items.findIndex((o, k) => r.ids[k] !== o.id);
      if (firstOff < 0) return right;
      return wrong(i.items[firstOff].feedback);
    }
    case "blanks": {
      const r = response as Extract<Response, { kind: "blanks" }>;
      if (r.values.length !== i.blanks.length || r.values.some((v) => !v.trim())) return { status: "invalid", message: "Fill in every blank." };
      if (r.values.some((v) => !parseRational(v))) return { status: "invalid", message: "Each blank takes a number." };
      const parts = i.blanks.map((b, k) => numbersEqual(r.values[k], b.answer));
      if (parts.every(Boolean)) return { ...right, parts };
      const k = parts.indexOf(false);
      const value = parseRational(r.values[k])!;
      return { ...wrong(slipFor(i.blanks[k].slips, (a) => numbersEqual(a, rShow(value)))), parts };
    }
    case "tap": {
      const r = response as Extract<Response, { kind: "tap" }>;
      if (!r.ids.length) return { status: "invalid", message: "Tap the figure to choose." };
      return sameSet(r.ids, i.answers) ? right : wrong();
    }
    case "explain": {
      const r = response as Extract<Response, { kind: "explain" }>;
      if (r.text.trim().length < 12) return { status: "invalid", message: "Write a sentence or two in your own words first." };
      const all = i.points.every((_, k) => r.covered.includes(k));
      return { status: all ? "correct" : "incorrect", message: all ? card.feedback.correct : card.feedback.incorrect, selfReported: true };
    }
  }
}
